import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Icon from '../../components/Icons';
import './StaffManagement.css';

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  employeeId: string;
  joinDate: string;
  status: string;
}

const Staffs = () => {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStaffs();
  }, []);

  const fetchStaffs = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'staffs'));
      const staffsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];
      setStaffs(staffsData);
    } catch (error) {
      console.error('Error fetching staffs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'staffs', id), { status: newStatus });
      fetchStaffs();
    } catch (error) {
      console.error('Error updating staff status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await deleteDoc(doc(db, 'staffs', id));
        fetchStaffs();
      } catch (error) {
        console.error('Error deleting staff:', error);
      }
    }
  };

  const filteredStaffs = staffs.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="staff-management">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2>Staffs Management</h2>
          <Link to="/staffs/create" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            + Create New Staff
          </Link>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading staffs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management">
      <h2 style={{ marginBottom: '24px', color: '#1f2937', fontSize: '1.75rem', fontWeight: '600' }}>Staffs Management</h2>
      <div className="management-header">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search staffs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <select className="filter-select">
          <option>All Departments</option>
          <option>Cardiology</option>
          <option>Emergency</option>
          <option>Surgery</option>
          <option>Pediatrics</option>
          <option>Nursing</option>
          <option>Administration</option>
        </select>
        <select className="filter-select">
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
          <option>On Leave</option>
        </select>
        <div className="action-buttons">
          <button className="btn-export">Export</button>
          <Link to="/staffs/create" className="btn-new-record">
            New Record
          </Link>
        </div>
      </div>
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Department</th>
              <th>Position</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaffs.length === 0 ? (
              <tr>
                <td colSpan={9} className="no-data">No staff members found</td>
              </tr>
            ) : (
              filteredStaffs.map((staff) => (
                <tr key={staff.id}>
                  <td>{staff.employeeId}</td>
                  <td>{staff.name}</td>
                  <td>{staff.email}</td>
                  <td>{staff.phone}</td>
                  <td>{staff.department}</td>
                  <td>{staff.position}</td>
                  <td>{staff.joinDate}</td>
                  <td>
                    <select
                      value={staff.status || 'active'}
                      onChange={(e) => handleStatusChange(staff.id, e.target.value)}
                      className={`status-select ${staff.status}`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on-leave">On Leave</option>
                    </select>
                  </td>
                  <td>
                    <div className="action-icons">
                      <button className="action-icon view" title="View">
                        <Icon name="view" />
                      </button>
                      <button className="action-icon edit" title="Edit">
                        <Icon name="edit" />
                      </button>
                      <button className="action-icon bill" title="Details">
                        <Icon name="bill" />
                      </button>
                      <button 
                        className="action-icon delete" 
                        title="Delete"
                        onClick={() => handleDelete(staff.id)}
                      >
                        <Icon name="delete" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Staffs;

