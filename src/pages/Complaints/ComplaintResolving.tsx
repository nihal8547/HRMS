import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin } from '../../utils/userRole';
import { fetchAllEmployees } from '../../utils/fetchEmployees';
import { usePagePermissions } from '../../hooks/usePagePermissions';
import Icon from '../../components/Icons';
import '../Staffs/StaffManagement.css';

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

const ComplaintResolving = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const navigate = useNavigate();
  const { canEditDelete } = usePagePermissions('Complaints');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await fetchComplaints(user.uid, role);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchComplaints = async (uid: string, role: string) => {
    try {
      setLoading(true);
      const adminUser = isAdmin(role);
      let snapshot;

      if (adminUser) {
        // Admin can see all complaints
        snapshot = await getDocs(collection(db, 'complaints'));
      } else {
        // Non-admin users can only see their own complaints
        const employees = await fetchAllEmployees();
        const userEmployee = employees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          snapshot = await getDocs(query(collection(db, 'complaints'), where('employeeId', '==', userEmployee.employeeId)));
        } else {
          snapshot = { docs: [] } as any;
        }
      }

      const complaintsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Complaint[];

      setComplaints(complaintsData.sort((a, b) => 
        (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
      ));
    } catch (error) {
      // Error handled - show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    if (!canEditDelete) {
      alert('You do not have permission to update complaint status.');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'complaints', id), { 
        status: newStatus,
        updatedAt: new Date()
      });
      await fetchComplaints(currentUserId, userRole);
    } catch (error) {
      // Error handled
    }
  };

  const filteredComplaints = complaints.filter(complaint => {
    const matchesFilter = filter === 'all' || complaint.status === filter;
    const matchesSearch = 
      complaint.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="full-page">
        <div className="staff-management">
          <div className="page-header-with-back">
            <button className="back-button" onClick={() => navigate('/complaints')}>
              <Icon name="chevron-left" /> Back
            </button>
            <h2>Complaint Resolving</h2>
          </div>
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Loading complaints...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-page">
      <div className="staff-management">
        <div className="page-header-with-back">
          <button className="back-button" onClick={() => navigate('/complaints')}>
            <Icon name="chevron-left" /> Back
          </button>
          <h2>Complaint Resolving</h2>
        </div>

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
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {filteredComplaints.length === 0 ? (
          <div className="no-data">
            <p>No complaints found</p>
          </div>
        ) : (
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
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>{complaint.employeeId || 'N/A'}</td>
                    <td>{complaint.name || 'N/A'}</td>
                    <td>{complaint.complaintType || 'N/A'}</td>
                    <td title={complaint.subject || ''}>
                      {(complaint.subject || '').length > 50 
                        ? (complaint.subject || '').substring(0, 50) + '...' 
                        : complaint.subject || 'N/A'}
                    </td>
                    <td>
                      <span className={`badge ${
                        complaint.priority === 'high' ? 'badge-error' :
                        complaint.priority === 'medium' ? 'badge-warning' :
                        'badge-info'
                      }`}>
                        {complaint.priority || 'medium'}
                      </span>
                    </td>
                    <td>
                      {isAdminUser ? (
                        <select
                          value={complaint.status || 'pending'}
                          onChange={(e) => handleStatusUpdate(complaint.id, e.target.value)}
                          className={`status-select ${complaint.status || 'pending'}`}
                          style={{ minWidth: '120px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      ) : (
                        <span className={`status-badge ${complaint.status || 'pending'}`}>
                          {complaint.status || 'pending'}
                        </span>
                      )}
                    </td>
                    <td>
                      {complaint.createdAt?.toDate?.() 
                        ? (() => {
                            const date = complaint.createdAt.toDate();
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}/${month}/${year}`;
                          })()
                        : 'N/A'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/complaints/view/${complaint.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintResolving;
