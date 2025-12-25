import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin, canEditPageSync } from '../../utils/userRole';
import type { PermissionLevel } from '../../utils/userRole';
import { fetchAllEmployees } from '../../utils/fetchEmployees';
import { deleteUserData, deleteUserDataByEmployeeId } from '../../utils/deleteUserData';
import Icon from '../../components/Icons';
import './StaffManagement.css';

interface RolePermission {
  role: string;
  pages: {
    [pageName: string]: PermissionLevel | boolean;
  };
}

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  employeeId: string;
  joinDate: string;
  status: string;
  authUserId?: string;
  profileImageUrl?: string;
}

const Staffs = () => {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [canEdit, setCanEdit] = useState(true);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && isMounted) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        if (!isMounted) return;
        
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        
        // Fetch role permissions
        try {
          const snapshot = await getDocs(collection(db, 'rolePermissions'));
          const permissions = snapshot.docs.map(doc => ({
            role: doc.id,
            ...doc.data()
          })) as RolePermission[];
          if (!isMounted) return;
          
          setRolePermissions(permissions);
          
          // Check if user can edit this page
          const canEditPage = canEditPageSync('Staffs', role, permissions);
          setCanEdit(canEditPage);
          
          // Fetch staffs after permissions are loaded
          if (isMounted) {
          await fetchStaffs(user.uid, role, permissions);
          }
        } catch (error) {
          console.error('Error fetching role permissions:', error);
          setCanEdit(true); // Default to true on error
          if (isMounted) {
          await fetchStaffs(user.uid, role, []);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const fetchStaffs = async (_uid: string, role: string, permissions: RolePermission[] = []) => {
    try {
      setLoading(true);
      const adminUser = isAdmin(role);
      
      // Check permission level
      const rolePermission = permissions.find(rp => rp.role === role);
      const getPermissionLevel = (permission: PermissionLevel | boolean | undefined): PermissionLevel => {
        if (permission === undefined || permission === null) return 'edit';
        if (typeof permission === 'boolean') return permission ? 'edit' : 'not_access';
        return permission;
      };
      const permission = rolePermission ? getPermissionLevel(rolePermission.pages['Staffs']) : 'edit';
      
      if (adminUser || permission === 'edit' || permission === 'view') {
        // Admin, edit, or view users can see all staffs (view users see all data including admin updates)
        const employees = await fetchAllEmployees();
        
        // Map to Staff interface format and deduplicate by both id and employeeId
        const staffsMap = new Map<string, Staff>();
        const seenIds = new Set<string>();
        
        employees.forEach(emp => {
          // Use employeeId as primary key, fallback to id
          const key = emp.employeeId || emp.id;
          const docId = emp.id;
          
          // Skip if we've already seen this document ID or employeeId
          if (key && !seenIds.has(key) && !seenIds.has(docId)) {
            seenIds.add(key);
            seenIds.add(docId);
            staffsMap.set(key, {
          id: emp.id,
          name: emp.name || emp.fullName || '',
          email: emp.email || '',
          phone: emp.phone || '',
          department: emp.department || '',
          employeeId: emp.employeeId || '',
          joinDate: emp.joinDate || '',
              status: emp.status || 'active',
              authUserId: (emp as any).authUserId || emp.id,
              profileImageUrl: (emp as any).profileImageUrl || ''
            });
          }
        });
        
        // Convert map to array and ensure no duplicates
        const staffsData = Array.from(staffsMap.values());
        setStaffs(staffsData);
      } else {
        // No access - show empty
        setStaffs([]);
      }
    } catch (error) {
      console.error('Error fetching staffs:', error);
      setStaffs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!canEdit && !isAdminUser) {
      alert('You do not have permission to edit staff status.');
      return;
    }
    
    try {
      // Try to update in both collections
      try {
        await updateDoc(doc(db, 'staffs', id), { status: newStatus });
      } catch {
        // If not in staffs, try employees
        await updateDoc(doc(db, 'employees', id), { status: newStatus });
      }
      await fetchStaffs(currentUserId, userRole, rolePermissions);
    } catch (error) {
      console.error('Error updating staff status:', error);
      alert('Error updating staff status. Please try again.');
    }
  };

  const handleDelete = async (staff: Staff) => {
    if (!isAdminUser) {
      alert('Only administrators can delete staff members.');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${staff.name} (${staff.employeeId})?\n\nThis will permanently delete:\n- All user data from database\n- User account from authentication\n- All related records\n\nThis action cannot be undone!`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('You must be logged in to delete staff members.');
        return;
      }

      // Try to delete using employeeId first (more reliable)
      let result;
      if (staff.employeeId) {
        result = await deleteUserDataByEmployeeId(staff.employeeId, currentUser);
      } else if (staff.authUserId) {
        result = await deleteUserData(staff.authUserId, currentUser);
      } else {
        // Fallback: try using the document ID
        result = await deleteUserData(staff.id, currentUser);
      }

      if (result.success) {
        alert(`Staff member deleted successfully.\n\nDeleted from: ${result.deletedFrom.join(', ')}`);
        // Refresh the staff list
        await fetchStaffs(currentUserId, userRole, rolePermissions);
      } else {
        // Check if it's a partial success
        if (result.deletedFrom.length > 0) {
          alert(`Staff member partially deleted.\n\nDeleted from: ${result.deletedFrom.join(', ')}\n\nNote: ${result.message}\n\nYou may need to delete the user from Firebase Authentication manually using Firebase Console.`);
          // Refresh the staff list anyway
          await fetchStaffs(currentUserId, userRole, rolePermissions);
        } else {
          alert(`Failed to delete staff member: ${result.message}\n\nPlease try using the User Deletion tool in Settings page.`);
        }
      }
    } catch (error: any) {
      console.error('Error deleting staff:', error);
      alert(`Error deleting staff member: ${error.message}\n\nPlease try using the User Deletion tool in Settings page.`);
    }
  };

  const handleEdit = (staff: Staff) => {
    if (!canEdit && !isAdminUser) {
      alert('You do not have permission to edit staff members.');
      return;
    }
    // Navigate to edit page or open edit modal
    navigate(`/staffs/view/${staff.employeeId || staff.id}`);
  };

  const handleExport = () => {
    // Export functionality
    const csvContent = [
      ['Emp ID', 'Name', 'Email', 'Phone', 'Department', 'Join Date'],
      ...filteredStaffs.map(staff => [
        staff.employeeId,
        staff.name,
        staff.email,
        staff.phone,
        staff.department,
        staff.joinDate
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staffs_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleViewProfile = (staff: Staff) => {
    // Navigate to employee profile view page
    // Use employeeId if available, otherwise use document ID
    const viewId = staff.employeeId || staff.id;
    navigate(`/staffs/view/${viewId}`);
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
        <select 
          className="filter-select"
          onChange={(e) => {
            const dept = e.target.value;
            if (dept === 'All Departments') {
              setSearchTerm('');
            } else {
              // Filter by department
              // Filter by department is handled by filteredStaffs which uses searchTerm
              staffs.filter(s => s.department === dept);
              // This is handled by filteredStaffs which uses searchTerm
            }
          }}
        >
          <option>All Departments</option>
          {[...new Set(staffs.map(s => s.department).filter(Boolean))].map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <div className="action-buttons">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <Icon name="list" />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title="Card View"
            >
              <Icon name="grid" />
            </button>
          </div>
          <button className="btn-export" onClick={handleExport}>Export</button>
          {(isAdminUser || canEdit) && (
            <Link to="/staffs/create" className="btn-new-record">
              New Record
            </Link>
          )}
        </div>
      </div>
      {viewMode === 'table' ? (
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>
                <div className="table-header-with-icon">
                  <Icon name="user" />
                  <span>Image</span>
                </div>
              </th>
              <th>
                <div className="table-header-with-icon">
                  <Icon name="id-card" />
                  <span>Emp ID</span>
                </div>
              </th>
              <th>
                <div className="table-header-with-icon">
                  <Icon name="user" />
                  <span>Name</span>
                </div>
              </th>
              <th>
                <div className="table-header-with-icon">
                  <Icon name="mail" />
                  <span>Email</span>
                </div>
              </th>
              <th>
                <div className="table-header-with-icon">
                  <Icon name="phone" />
                  <span>Phone</span>
                </div>
              </th>
              <th>
                <div className="table-header-with-icon">
                  <Icon name="briefcase" />
                  <span>Department</span>
                </div>
              </th>
              <th>
                <div className="table-header-with-icon">
                  <Icon name="calendar" />
                  <span>Join Date</span>
                </div>
              </th>
              <th>
                <div className="table-header-with-icon">
                  <Icon name="settings" />
                  <span>Actions</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredStaffs.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-data">No staff members found</td>
              </tr>
            ) : (
              filteredStaffs.map((staff) => (
                <tr key={staff.id}>
                  <td>
                    <div className="staff-image-cell">
                      {staff.profileImageUrl ? (
                        <img 
                          src={staff.profileImageUrl} 
                          alt={staff.name}
                          className="staff-table-image"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      {!staff.profileImageUrl && (
                        <div className="staff-table-image-placeholder">
                          <Icon name="user" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{staff.employeeId}</td>
                  <td>
                    <span 
                      className="employee-name-link"
                      onClick={() => handleViewProfile(staff)}
                      title="Click to view profile"
                    >
                      {staff.name}
                    </span>
                  </td>
                  <td>{staff.email}</td>
                  <td>{staff.phone}</td>
                  <td>{staff.department}</td>
                  <td>{staff.joinDate}</td>
                  <td>
                    <div className="action-icons">
                      <button 
                        className="action-icon view" 
                        title="View Profile"
                        onClick={() => handleViewProfile(staff)}
                      >
                        <Icon name="view" />
                      </button>
                      {(isAdminUser || canEdit) && (
                        <button 
                          className="action-icon edit" 
                          title="Edit"
                          onClick={() => handleEdit(staff)}
                        >
                          <Icon name="edit" />
                        </button>
                      )}
                      {isAdminUser && (
                        <button 
                          className="action-icon delete" 
                          title="Delete"
                          onClick={() => handleDelete(staff)}
                        >
                          <Icon name="delete" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="staff-cards-container">
          {filteredStaffs.length === 0 ? (
            <div className="no-data-card">
              <p>No staff members found</p>
            </div>
          ) : (
            <div className="staff-cards-grid">
              {filteredStaffs.map((staff) => (
                <div key={staff.id} className="staff-card">
                  <div className="staff-card-image-container">
                    {staff.profileImageUrl ? (
                      <img 
                        src={staff.profileImageUrl} 
                        alt={staff.name}
                        className="staff-card-image"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    {!staff.profileImageUrl && (
                      <div className="staff-card-image-placeholder">
                        <Icon name="user" />
                      </div>
                    )}
                  </div>
                  <div className="staff-card-header">
                    <div className="staff-card-info">
                      <div className="staff-card-name-row">
                        <h3 
                          className="staff-card-name"
                          onClick={() => handleViewProfile(staff)}
                          title="Click to view profile"
                        >
                          {staff.name}
                        </h3>
                      </div>
                      <div className="staff-card-id-row">
                        <Icon name="id-card" />
                        <p className="staff-card-id">ID: {staff.employeeId}</p>
                      </div>
                    </div>
                  </div>
                  <div className="staff-card-body">
                    <div className="staff-card-detail">
                      <Icon name="mail" />
                      <span>{staff.email || 'N/A'}</span>
                    </div>
                    <div className="staff-card-detail">
                      <Icon name="phone" />
                      <span>{staff.phone || 'N/A'}</span>
                    </div>
                    <div className="staff-card-detail">
                      <Icon name="briefcase" />
                      <span>{staff.department || 'N/A'}</span>
                    </div>
                    <div className="staff-card-detail">
                      <Icon name="calendar" />
                      <span>{staff.joinDate || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="staff-card-actions">
                    <button 
                      className="card-action-btn view" 
                      title="View Profile"
                      onClick={() => handleViewProfile(staff)}
                    >
                      <Icon name="view" />
                      <span>View</span>
                    </button>
                    {(isAdminUser || canEdit) && (
                      <button 
                        className="card-action-btn edit" 
                        title="Edit"
                        onClick={() => handleEdit(staff)}
                      >
                        <Icon name="edit" />
                        <span>Edit</span>
                      </button>
                    )}
                    {isAdminUser && (
                      <button 
                        className="card-action-btn delete" 
                        title="Delete"
                        onClick={() => handleDelete(staff)}
                      >
                        <Icon name="delete" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Staffs;

