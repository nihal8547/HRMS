import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin } from '../../utils/userRole';
import Icon from '../../components/Icons';
import './StaffManagement.css';

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

const StaffManagement = () => {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        await fetchStaffs(user.uid, role);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchStaffs = async (uid: string, role: string) => {
    try {
      const adminUser = isAdmin(role);
      
      if (adminUser) {
        // Admin can see all staffs
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
        // Non-admin users can only see their own profile
        const employees = await fetchAllEmployees();
        // Filter to show only current user's data
        const userEmployee = employees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee) {
          setStaffs([{
            id: userEmployee.id,
            name: userEmployee.name || userEmployee.fullName || '',
            email: userEmployee.email || '',
            phone: userEmployee.phone || '',
            department: userEmployee.department || '',
            employeeId: userEmployee.employeeId || '',
            joinDate: userEmployee.joinDate || '',
            status: userEmployee.status || 'active'
          }]);
        } else {
          setStaffs([]);
        }
      }
    } catch (error) {
      console.error('Error fetching staffs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'staffs', id), { status: newStatus });
      if (currentUserId && userRole) {
        await fetchStaffs(currentUserId, userRole);
      }
    } catch (error) {
      console.error('Error updating staff status:', error);
    }
  };

  // Delete functionality removed - Staffs cannot be deleted
  // Use the user deletion script in Settings for complete user data removal

  const handleEdit = (_id: string) => {
    // Navigate to edit page or open edit modal
    // For now, just close dropdown
    setOpenDropdown(null);
    // TODO: Implement edit functionality
  };

  const handleView = (staff: Staff) => {
    // Navigate to employee profile view page
    // The view page can handle both document ID and employeeId lookups
    // Prefer employeeId if available, otherwise use document ID
    const viewId = staff.employeeId || staff.id;
    navigate(`/staffs/view/${viewId}`);
    setOpenDropdown(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown && !(event.target as Element).closest('.action-dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const filteredStaffs = staffs.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading staffs...</div>;
  }

  return (
    <div className="full-page">
      <div className="staff-management">
        <div className="page-header-with-back">
          <button className="back-button" onClick={() => navigate('/staffs')}>
            <Icon name="chevron-left" /> Back
          </button>
          <h2>Staff Management</h2>
        </div>
      <div className="management-header">
        <input
          type="text"
          placeholder="Search by name, ID, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="staff-count">
          Total Staffs: {staffs.length}
        </div>
      </div>
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaffs.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-data">No staff members found</td>
              </tr>
            ) : (
              filteredStaffs.map((staff) => (
                <tr key={staff.id}>
                  <td>{staff.employeeId}</td>
                  <td>{staff.name}</td>
                  <td>{staff.email}</td>
                  <td>{staff.department}</td>
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
                    <div className="action-dropdown-container">
                      <button
                        className="action-dropdown-btn"
                        onClick={() => setOpenDropdown(openDropdown === staff.id ? null : staff.id)}
                      >
                        Actions <Icon name="chevron-down" />
                      </button>
                      {openDropdown === staff.id && (
                        <div className="action-dropdown-menu">
                          <button
                            className="action-menu-item view"
                            onClick={() => handleView(staff)}
                          >
                            View
                          </button>
                          <button
                            className="action-menu-item edit"
                            onClick={() => handleEdit(staff.id)}
                          >
                            Edit
                          </button>
                        </div>
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
    </div>
  );
};

export default StaffManagement;








