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

interface Leave {
  id: string;
  employeeId: string;
  name: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  createdAt: any;
}

const LeaveStatus = () => {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const navigate = useNavigate();
  const { canEditDelete } = usePagePermissions('Leave');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await fetchLeaves(user.uid, role);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchLeaves = async (uid: string, role: string) => {
    try {
      setLoading(true);
      const adminUser = isAdmin(role);
      let snapshot;

      if (adminUser) {
        // Admin can see all leaves
        snapshot = await getDocs(collection(db, 'leaves'));
      } else {
        // Non-admin users can only see their own leaves
        const allEmployees = await fetchAllEmployees();
        const userEmployee = allEmployees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          snapshot = await getDocs(query(
            collection(db, 'leaves'),
            where('employeeId', '==', userEmployee.employeeId)
          ));
        } else {
          // No employee found, return empty
          snapshot = { docs: [] } as any;
        }
      }

      const leavesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Leave[];
      
      setLeaves(leavesData.sort((a, b) => 
        b.createdAt?.toDate?.()?.getTime() - a.createdAt?.toDate?.()?.getTime()
      ));
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    // Partial access users cannot edit status - only full access users can
    if (!canEditDelete) {
      alert('You do not have permission to update leave status. Partial access users can only create and submit their own data.');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'leaves', id), { 
        status: newStatus,
        updatedAt: new Date()
      });
      if (currentUserId && userRole) {
        await fetchLeaves(currentUserId, userRole);
      }
    } catch (error) {
      console.error('Error updating leave status:', error);
    }
  };

  const filteredLeaves = leaves.filter(leave => {
    const matchesFilter = filter === 'all' || leave.status === filter;
    const matchesSearch = 
      leave.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leave.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="full-page">
        <div className="staff-management">
          <div className="page-header-with-back">
            <button className="back-button" onClick={() => navigate('/leave')}>
              <Icon name="chevron-left" /> Back
            </button>
            <h2>Leave Request Status</h2>
          </div>
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Loading leave requests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-page">
      <div className="staff-management">
        <div className="page-header-with-back">
          <button className="back-button" onClick={() => navigate('/leave')}>
            <Icon name="chevron-left" /> Back
          </button>
          <h2>Leave Request Status</h2>
        </div>
      <div className="management-header">
        <input
          type="text"
          placeholder="Search by employee ID or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="status-select"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Leave Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Reason</th>
              <th>Status</th>
              {canEditDelete && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan={canEditDelete ? 8 : 7} className="no-data">No leave requests found</td>
              </tr>
            ) : (
              filteredLeaves.map((leave) => (
                <tr key={leave.id}>
                  <td>{leave.employeeId}</td>
                  <td>{leave.name}</td>
                  <td>{leave.leaveType}</td>
                  <td>{leave.startDate}</td>
                  <td>{leave.endDate}</td>
                  <td>{leave.reason}</td>
                  <td>
                    {canEditDelete ? (
                      <select
                        value={leave.status}
                        onChange={(e) => handleStatusUpdate(leave.id, e.target.value)}
                        className={`status-select ${leave.status}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    ) : (
                      <span className={`status-badge ${leave.status}`}>
                        {leave.status}
                      </span>
                    )}
                  </td>
                  {canEditDelete && (
                    <td>
                      <div className="action-icons">
                        <button
                          className="action-icon edit"
                          onClick={() => handleStatusUpdate(leave.id, leave.status === 'approved' ? 'rejected' : 'approved')}
                          title={leave.status === 'approved' ? 'Reject' : 'Approve'}
                        >
                          <Icon name={leave.status === 'approved' ? 'delete' : 'edit'} />
                        </button>
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
    </div>
  );
};

export default LeaveStatus;

