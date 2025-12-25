import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin, canEditPageSync } from '../../utils/userRole';
import type { PermissionLevel } from '../../utils/userRole';
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
  const navigate = useNavigate();

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
          const canEditPage = canEditPageSync('Staffs', role, permissions);
          setCanEdit(canEditPage);
          
          // Fetch staffs after permissions are loaded
          await fetchStaffs(user.uid, role, permissions);
        } catch (error) {
          console.error('Error fetching role permissions:', error);
          setCanEdit(true); // Default to true on error
          await fetchStaffs(user.uid, role, []);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchStaffs = async (uid: string, role: string, permissions: RolePermission[] = []) => {
    try {
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
        const { fetchAllEmployees } = await import('../../utils/fetchEmployees');
        const employees = await fetchAllEmployees();
        // Map to Staff interface format
        const staffsData = employees.map(emp => ({
          id: emp.id,
          name: emp.name || emp.fullName || '',
          email: emp.email || '',
          phone: emp.phone || '',
          department: emp.department || '',
          employeeId: emp.employeeId || '',
          joinDate: emp.joinDate || '',
          status: emp.status || 'active'
        })) as Staff[];
        setStaffs(staffsData);
      } else {
        // No access - show empty
        setStaffs([]);
      }
    } catch (error) {
      console.error('Error fetching staffs:', error);
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

  const handleDelete = async (id: string) => {
    if (!isAdminUser && !canEdit) {
      alert('You do not have permission to delete staff members.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        // Try to delete from both collections
        try {
          await deleteDoc(doc(db, 'staffs', id));
        } catch {
          await deleteDoc(doc(db, 'employees', id));
        }
        await fetchStaffs(currentUserId, userRole, rolePermissions);
      } catch (error) {
        console.error('Error deleting staff:', error);
        alert('Error deleting staff member. Please try again.');
      }
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
      ['Emp ID', 'Name', 'Email', 'Phone', 'Department', 'Join Date', 'Status'],
      ...filteredStaffs.map(staff => [
        staff.employeeId,
        staff.name,
        staff.email,
        staff.phone,
        staff.department,
        staff.joinDate,
        staff.status
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
              const filtered = staffs.filter(s => s.department === dept);
              // This is handled by filteredStaffs which uses searchTerm
            }
          }}
        >
          <option>All Departments</option>
          {[...new Set(staffs.map(s => s.department).filter(Boolean))].map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <select className="filter-select">
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
          <option>On Leave</option>
        </select>
        <div className="action-buttons">
          <button className="btn-export" onClick={handleExport}>Export</button>
          {(isAdminUser || canEdit) && (
            <Link to="/staffs/create" className="btn-new-record">
              New Record
            </Link>
          )}
        </div>
      </div>
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Department</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Actions</th>
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
                    {(isAdminUser || canEdit) ? (
                      <select
                        value={staff.status || 'active'}
                        onChange={(e) => handleStatusChange(staff.id, e.target.value)}
                        className={`status-select ${staff.status}`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on-leave">On Leave</option>
                      </select>
                    ) : (
                      <span className={`status-badge ${staff.status}`}>
                        {staff.status || 'active'}
                      </span>
                    )}
                  </td>
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
                          onClick={() => handleDelete(staff.id)}
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
    </div>
  );
};

export default Staffs;

