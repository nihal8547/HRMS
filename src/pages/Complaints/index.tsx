import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin, canEditPageSync } from '../../utils/userRole';
import type { PermissionLevel } from '../../utils/userRole';
import { usePagePermissions } from '../../hooks/usePagePermissions';
import Icon from '../../components/Icons';
import '../Staffs/StaffManagement.css';

interface RolePermission {
  role: string;
  pages: {
    [pageName: string]: PermissionLevel | boolean;
  };
}

interface Complaint {
  id: string;
  employeeId: string;
  name: string;
  complaintType: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: any;
}

const Complaints = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const navigate = useNavigate();
  const { canEditDelete } = usePagePermissions('Complaints');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        
        // Fetch role permissions
        try {
          const snapshot = await getDocs(collection(db, 'rolePermissions'));
          const permissions = snapshot.docs.map(doc => ({
            role: doc.id,
            ...doc.data()
          })) as RolePermission[];
          setRolePermissions(permissions);
          
          // Check if user can edit this page
          const canEditPage = canEditPageSync('Complaints', role, permissions);
          setCanEdit(canEditPage);
          
          // Fetch complaints after permissions are loaded
          await fetchComplaints(user.uid, role, permissions);
        } catch (error) {
          console.error('Error fetching role permissions:', error);
          setCanEdit(true);
          await fetchComplaints(user.uid, role, []);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchComplaints = async (uid: string, role: string, permissions: RolePermission[] = []) => {
    try {
      const adminUser = isAdmin(role);
      
      // Check permission level
      const rolePermission = permissions.find(rp => rp.role === role);
      const getPermissionLevel = (permission: PermissionLevel | boolean | undefined): PermissionLevel => {
        if (permission === undefined || permission === null) return 'edit';
        if (typeof permission === 'boolean') return permission ? 'edit' : 'not_access';
        return permission;
      };
      const permission = rolePermission ? getPermissionLevel(rolePermission.pages['Complaints']) : 'edit';
      
      // Admin, edit, or view users can see all complaints (view users see all data including admin updates)
      if (adminUser || permission === 'edit' || permission === 'view') {
        const snapshot = await getDocs(collection(db, 'complaints'));
        const complaintsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Complaint[];
        setComplaints(complaintsData.sort((a, b) => 
          (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
        ));
      } else {
        // No access or only own data
        const { fetchAllEmployees } = await import('../../utils/fetchEmployees');
        const employees = await fetchAllEmployees();
        const userEmployee = employees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          const snapshot = await getDocs(query(collection(db, 'complaints'), where('employeeId', '==', userEmployee.employeeId)));
          const complaintsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Complaint[];
          setComplaints(complaintsData.sort((a, b) => 
            (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
          ));
        } else {
          setComplaints([]);
        }
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    // Partial access users cannot edit status - only full access users can
    if (!canEditDelete) {
      alert('You do not have permission to update complaint status. Partial access users can only create and submit their own data.');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'complaints', id), { 
        status: newStatus,
        updatedAt: new Date()
      });
      await fetchComplaints(currentUserId, userRole, rolePermissions);
    } catch (error) {
      console.error('Error updating complaint status:', error);
      alert('Error updating complaint status. Please try again.');
    }
  };

  const handleView = (complaint: Complaint) => {
    navigate(`/complaints/resolving`);
  };

  const handleEdit = (complaint: Complaint) => {
    if (!canEdit && !isAdminUser) {
      alert('You do not have permission to edit complaints.');
      return;
    }
    navigate(`/complaints/registration`);
  };

  const handleDelete = async (id: string) => {
    if (!isAdminUser && !canEdit) {
      alert('You do not have permission to delete complaints.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this complaint?')) {
      try {
        await deleteDoc(doc(db, 'complaints', id));
        await fetchComplaints(currentUserId, userRole, rolePermissions);
      } catch (error) {
        console.error('Error deleting complaint:', error);
        alert('Error deleting complaint. Please try again.');
      }
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Employee ID', 'Name', 'Type', 'Subject', 'Priority', 'Status'],
      ...filteredComplaints.map(complaint => [
        complaint.employeeId,
        complaint.name,
        complaint.complaintType,
        complaint.subject,
        complaint.priority,
        complaint.status
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complaints_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredComplaints = complaints.filter(complaint => {
    const matchesFilter = filter === 'all' || complaint.status === filter;
    const matchesType = typeFilter === 'all' || complaint.complaintType === typeFilter;
    const matchesSearch = 
      complaint.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesType && matchesSearch;
  });

  if (loading) {
    return (
      <div className="staff-management">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2>Complaints Management</h2>
          <Link to="/complaints/registration" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            + Register Complaint
          </Link>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading complaints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management">
      <h2 style={{ marginBottom: '24px', color: '#1f2937', fontSize: '1.75rem', fontWeight: '600' }}>Complaints Management</h2>
      <div className="management-header">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search complaints..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select 
          className="filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="Workplace">Workplace</option>
          <option value="Equipment">Equipment</option>
          <option value="Staff">Staff</option>
          <option value="Patient">Patient</option>
        </select>
        <div className="action-buttons">
          <button className="btn-export" onClick={handleExport}>Export</button>
          {(isAdminUser || canEdit) && (
            <Link to="/complaints/registration" className="btn-new-record">
              New Record
            </Link>
          )}
        </div>
      </div>
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Type</th>
              <th>Subject</th>
              <th>Priority</th>
              <th>Status</th>
              {canEditDelete && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredComplaints.length === 0 ? (
              <tr>
                <td colSpan={canEditDelete ? 7 : 6} className="no-data">No complaints found</td>
              </tr>
            ) : (
              filteredComplaints.map((complaint) => (
                <tr key={complaint.id}>
                  <td>{complaint.employeeId}</td>
                  <td>{complaint.name}</td>
                  <td>{complaint.complaintType}</td>
                  <td>{complaint.subject}</td>
                  <td>
                    <span className={`priority-badge ${complaint.priority}`}>
                      {complaint.priority}
                    </span>
                  </td>
                  <td>
                    {canEditDelete ? (
                      <select
                        value={complaint.status}
                        onChange={(e) => handleStatusUpdate(complaint.id, e.target.value)}
                        className={`status-select ${complaint.status}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    ) : (
                      <span className={`status-badge ${complaint.status}`}>
                        {complaint.status}
                      </span>
                    )}
                  </td>
                  {canEditDelete && (
                    <td>
                      <div className="action-icons">
                        <button 
                          className="action-icon view" 
                          title="View"
                          onClick={() => handleView(complaint)}
                        >
                          <Icon name="view" />
                        </button>
                        {(isAdminUser || canEdit) && (
                          <>
                            <button 
                              className="action-icon edit" 
                              title="Edit"
                              onClick={() => handleEdit(complaint)}
                            >
                              <Icon name="edit" />
                            </button>
                            {isAdminUser && (
                              <button 
                                className="action-icon delete" 
                                title="Delete"
                                onClick={() => handleDelete(complaint.id)}
                              >
                                <Icon name="delete" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Complaints;

