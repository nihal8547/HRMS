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
import './Requests.css';

interface RolePermission {
  role: string;
  pages: {
    [pageName: string]: PermissionLevel | boolean;
  };
}

interface Request {
  id: string;
  employeeId: string;
  name: string;
  type: string;
  itemName?: string;
  quantity?: string;
  unit?: string;
  priority?: string;
  status: string;
  createdAt: any;
}

const Requests = () => {
  const [requests, setRequests] = useState<Request[]>([]);
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
  const { canEditDelete } = usePagePermissions('Requests');

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
          const canEditPage = canEditPageSync('Requests', role, permissions);
          setCanEdit(canEditPage);
          
          // Fetch requests after permissions are loaded
          await fetchRequests(user.uid, role, permissions);
        } catch (error) {
          console.error('Error fetching role permissions:', error);
          setCanEdit(true);
          await fetchRequests(user.uid, role, []);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchRequests = async (uid: string, role: string, permissions: RolePermission[] = []) => {
    try {
      const adminUser = isAdmin(role);
      
      // Check permission level
      const rolePermission = permissions.find(rp => rp.role === role);
      const getPermissionLevel = (permission: PermissionLevel | boolean | undefined): PermissionLevel => {
        if (permission === undefined || permission === null) return 'edit';
        if (typeof permission === 'boolean') return permission ? 'edit' : 'not_access';
        return permission;
      };
      const permission = rolePermission ? getPermissionLevel(rolePermission.pages['Requests']) : 'edit';
      
      // Admin, edit, or view users can see all requests (view users see all data including admin updates)
      if (adminUser || permission === 'edit' || permission === 'view') {
        const snapshot = await getDocs(collection(db, 'requests'));
        const requestsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Request[];
        setRequests(requestsData.sort((a, b) => 
          (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
        ));
      } else {
        // No access or only own data
        const employees = await fetchAllEmployees();
        const userEmployee = employees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          const snapshot = await getDocs(query(collection(db, 'requests'), where('employeeId', '==', userEmployee.employeeId)));
          const requestsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Request[];
          setRequests(requestsData.sort((a, b) => 
            (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)
          ));
        } else {
          setRequests([]);
        }
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    // Partial access users cannot edit status - only full access users can
    if (!canEditDelete) {
      alert('You do not have permission to update request status. Partial access users can only create and submit their own data.');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'requests', id), { 
        status: newStatus,
        updatedAt: new Date()
      });
      await fetchRequests(currentUserId, userRole, rolePermissions);
    } catch (error) {
      console.error('Error updating request status:', error);
      alert('Error updating request status. Please try again.');
    }
  };

  const handleView = (request: Request) => {
    // Show request details
    alert(`Request Details:\nType: ${request.type}\nItem: ${request.itemName || 'N/A'}\nStatus: ${request.status}`);
  };

  const handleEdit = (request: Request) => {
    if (!canEdit && !isAdminUser) {
      alert('You do not have permission to edit requests.');
      return;
    }
    // Navigate to edit page based on type
    if (request.type === 'purchasing') {
      navigate('/requests/purchasing');
    } else if (request.type === 'using') {
      navigate('/requests/using');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdminUser && !canEdit) {
      alert('You do not have permission to delete requests.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this request?')) {
      try {
        await deleteDoc(doc(db, 'requests', id));
        await fetchRequests(currentUserId, userRole, rolePermissions);
      } catch (error) {
        console.error('Error deleting request:', error);
        alert('Error deleting request. Please try again.');
      }
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Employee ID', 'Name', 'Type', 'Item Name', 'Quantity', 'Priority', 'Status'],
      ...filteredRequests.map(request => [
        request.employeeId,
        request.name,
        request.type,
        request.itemName || '-',
        request.quantity ? `${request.quantity} ${request.unit || ''}` : '-',
        request.priority || '-',
        request.status
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `requests_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredRequests = requests.filter(request => {
    const matchesFilter = filter === 'all' || request.status === filter;
    const matchesType = typeFilter === 'all' || request.type === typeFilter.toLowerCase();
    const matchesSearch = 
      request.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.itemName && request.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesType && matchesSearch;
  });

  if (loading) {
    return (
      <div className="staff-management requests-management">
        <div className="requests-header">
          <h2>Requests Management</h2>
          <div className="requests-actions">
            <Link to="/requests/purchasing" className="btn btn-primary">
              Item Purchasing
            </Link>
            <Link to="/requests/using" className="btn" style={{ background: '#10b981', color: 'white' }}>
              Item Using
            </Link>
          </div>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management requests-management">
      <div className="requests-header">
        <h2>Requests Management</h2>
        <div className="requests-actions">
          <Link to="/requests/purchasing" className="btn btn-primary">
            Item Purchasing
          </Link>
          <Link to="/requests/using" className="btn" style={{ background: '#10b981', color: 'white' }}>
            Item Using
          </Link>
        </div>
      </div>
      <div className="management-header">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search requests..."
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
          <option value="active">Active</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select 
          className="filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="purchasing">Purchasing</option>
          <option value="using">Using</option>
        </select>
        <div className="action-buttons">
          <button className="btn-export" onClick={handleExport}>Export</button>
          {(isAdminUser || canEdit) && (
            <Link to="/requests/purchasing" className="btn-new-record">
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
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Priority</th>
              <th>Status</th>
              {canEditDelete && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={canEditDelete ? 8 : 7} className="no-data">No requests found</td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>{request.employeeId}</td>
                  <td>{request.name}</td>
                  <td>{request.type}</td>
                  <td>{request.itemName || '-'}</td>
                  <td>{request.quantity ? `${request.quantity} ${request.unit || ''}` : '-'}</td>
                  <td>
                    {request.priority && (
                      <span className={`priority-badge ${request.priority}`}>
                        {request.priority}
                      </span>
                    )}
                  </td>
                  <td>
                    {canEditDelete ? (
                      <select
                        value={request.status}
                        onChange={(e) => handleStatusUpdate(request.id, e.target.value)}
                        className={`status-select ${request.status}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    ) : (
                      <span className={`status-badge ${request.status}`}>
                        {request.status}
                      </span>
                    )}
                  </td>
                  {canEditDelete && (
                    <td>
                      <div className="action-icons">
                        <button 
                          className="action-icon view" 
                          title="View"
                          onClick={() => handleView(request)}
                        >
                          <Icon name="view" />
                        </button>
                        {(isAdminUser || canEdit) && (
                          <>
                            <button 
                              className="action-icon edit" 
                              title="Edit"
                              onClick={() => handleEdit(request)}
                            >
                              <Icon name="edit" />
                            </button>
                            {isAdminUser && (
                              <button 
                                className="action-icon delete" 
                                title="Delete"
                                onClick={() => handleDelete(request.id)}
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

export default Requests;

