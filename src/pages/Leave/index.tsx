import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin, canEditPageSync } from '../../utils/userRole';
import type { PermissionLevel } from '../../utils/userRole';
import { fetchAllEmployees } from '../../utils/fetchEmployees';
import { usePagePermissions } from '../../hooks/usePagePermissions';
import Icon from '../../components/Icons';
import '../Staffs/StaffManagement.css';

interface RolePermission {
  role: string;
  pages: {
    [pageName: string]: PermissionLevel | boolean;
  };
}

interface Leave {
  id: string;
  employeeId: string;
  name: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  sickLeaveFileUrl?: string;
  createdAt: any;
}

const Leave = () => {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const navigate = useNavigate();
  const { canEditDelete } = usePagePermissions('Leave');

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
          const canEditPage = canEditPageSync('Leave', role, permissions);
          setCanEdit(canEditPage);
          
          // Fetch leaves after permissions are loaded
          await fetchLeaves(user.uid, role, permissions);
        } catch (error) {
          console.error('Error fetching role permissions:', error);
          setCanEdit(true);
          await fetchLeaves(user.uid, role, []);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchLeaves = async (uid: string, role: string, permissions: RolePermission[] = []) => {
    try {
      const adminUser = isAdmin(role);
      
      // Check permission level
      const rolePermission = permissions.find(rp => rp.role === role);
      const getPermissionLevel = (permission: PermissionLevel | boolean | undefined): PermissionLevel => {
        if (permission === undefined || permission === null) return 'edit';
        if (typeof permission === 'boolean') return permission ? 'edit' : 'not_access';
        return permission;
      };
      const permission = rolePermission ? getPermissionLevel(rolePermission.pages['Leave']) : 'edit';
      
      // Admin, edit, or view users can see all leaves (view users see all data including admin updates)
      if (adminUser || permission === 'edit' || permission === 'view') {
        const snapshot = await getDocs(collection(db, 'leaves'));
        const leavesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Leave[];
        setLeaves(leavesData.sort((a, b) => 
          (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
        ));
      } else {
        // No access or only own data
        const employees = await fetchAllEmployees();
        const userEmployee = employees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          const snapshot = await getDocs(query(collection(db, 'leaves'), where('employeeId', '==', userEmployee.employeeId)));
          const leavesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Leave[];
          setLeaves(leavesData.sort((a, b) => 
            (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
          ));
        } else {
          setLeaves([]);
        }
      }
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
      await fetchLeaves(currentUserId, userRole, rolePermissions);
    } catch (error) {
      console.error('Error updating leave status:', error);
      alert('Error updating leave status. Please try again.');
    }
  };

  const handleView = (_leave: Leave) => {
    // Navigate to leave details or show modal
    navigate(`/leave/status`);
  };

  const handleEdit = (_leave: Leave) => {
    if (!canEdit && !isAdminUser) {
      alert('You do not have permission to edit leave requests.');
      return;
    }
    // Navigate to edit page
    navigate(`/leave/request`);
  };

  const handleDelete = async (id: string) => {
    if (!isAdminUser && !canEdit) {
      alert('You do not have permission to delete leave requests.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this leave request?')) {
      try {
        await deleteDoc(doc(db, 'leaves', id));
        await fetchLeaves(currentUserId, userRole, rolePermissions);
      } catch (error) {
        console.error('Error deleting leave:', error);
        alert('Error deleting leave request. Please try again.');
      }
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Employee ID', 'Name', 'Leave Type', 'Start Date', 'End Date', 'Reason', 'Status'],
      ...filteredLeaves.map(leave => [
        leave.employeeId,
        leave.name,
        leave.leaveType,
        leave.startDate,
        leave.endDate,
        leave.reason,
        leave.status
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaves_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
      <div className="staff-management">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2>Leave Management</h2>
          <Link to="/leave/request" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            + New Leave Request
          </Link>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management">
      <h2 style={{ marginBottom: '24px', color: '#1f2937', fontSize: '1.75rem', fontWeight: '600' }}>Leave Management</h2>
      <div className="management-header">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search leaves..."
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
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className="action-buttons">
          <button className="btn-export" onClick={handleExport}>Export</button>
          {(isAdminUser || canEdit) && (
            <Link to="/leave/request" className="btn-new-record">
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
              <th>Leave Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Reason</th>
              <th>Sick Leave File</th>
              <th>Status</th>
              {canEditDelete && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan={canEditDelete ? 9 : 8} className="no-data">No leave requests found</td>
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
                    {leave.leaveType === 'Sick Leave' && leave.sickLeaveFileUrl ? (
                      <a
                        href={leave.sickLeaveFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#3b82f6',
                          textDecoration: 'none',
                          fontWeight: '500',
                          fontSize: '0.9rem'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon name="download" />
                        View File
                      </a>
                    ) : leave.leaveType === 'Sick Leave' ? (
                      <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem' }}>No file</span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>-</span>
                    )}
                  </td>
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
                          className="action-icon view" 
                          title="View"
                          onClick={() => handleView(leave)}
                        >
                          <Icon name="view" />
                        </button>
                        {(isAdminUser || canEdit) && (
                          <>
                            <button 
                              className="action-icon edit" 
                              title="Edit"
                              onClick={() => handleEdit(leave)}
                            >
                              <Icon name="edit" />
                            </button>
                            {isAdminUser && (
                              <button 
                                className="action-icon delete" 
                                title="Delete"
                                onClick={() => handleDelete(leave.id)}
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

export default Leave;

