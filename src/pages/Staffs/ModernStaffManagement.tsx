import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { fetchUserRole, isAdmin } from '../../utils/userRole';
import { fetchAllEmployees } from '../../utils/fetchEmployees';
import './ModernStaffManagement.css';

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  employeeId: string;
  joinDate: string;
  status: string;
  profileImageUrl?: string;
  // Leave data
  totalLeaves: number;
  annualLeaves: number;
  sickLeaves: number;
  emergencyLeaves: number;
  annualLeavesUsed: number;
  sickLeavesUsed: number;
  emergencyLeavesUsed: number;
  // Salary data
  monthlySalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  // Manager data
  managerName?: string;
  managerEmail?: string;
  managerAvatar?: string;
}

const ModernStaffManagement = () => {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const role = await fetchUserRole(user.uid);
        setIsAdminUser(isAdmin(role));
        await fetchStaffs(user.uid, role);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchStaffs = async (uid: string, role: string) => {
    try {
      setLoading(true);
      const employees = await fetchAllEmployees();
      
      // Transform employees to Staff with enhanced data
      const staffsData: Staff[] = employees.map((emp: any) => {
        // Calculate leave usage (mock data for now - can be fetched from leaves collection)
        const annualLeaves = 20; // Default annual leaves
        const sickLeaves = 10; // Default sick leaves
        const emergencyLeaves = 5; // Default emergency leaves
        
        const annualLeavesUsed = Math.floor(Math.random() * annualLeaves);
        const sickLeavesUsed = Math.floor(Math.random() * sickLeaves);
        const emergencyLeavesUsed = Math.floor(Math.random() * emergencyLeaves);
        
        // Salary data (mock - can be fetched from payroll collection)
        const monthlySalary = 5000 + Math.floor(Math.random() * 10000);
        const allowances = Math.floor(monthlySalary * 0.2);
        const deductions = Math.floor(monthlySalary * 0.1);
        const netSalary = monthlySalary + allowances - deductions;

        return {
          id: emp.id,
          name: emp.name || emp.fullName || 'Unknown',
          email: emp.email || '',
          phone: emp.phone || '',
          department: emp.department || 'Not Assigned',
          designation: emp.designation || emp.position || 'Employee',
          employeeId: emp.employeeId || '',
          joinDate: emp.joinDate || '',
          status: emp.status || 'active',
          profileImageUrl: emp.profileImageUrl,
          totalLeaves: annualLeavesUsed + sickLeavesUsed + emergencyLeavesUsed,
          annualLeaves,
          sickLeaves,
          emergencyLeaves,
          annualLeavesUsed,
          sickLeavesUsed,
          emergencyLeavesUsed,
          monthlySalary,
          allowances,
          deductions,
          netSalary,
          managerName: 'John Manager', // Mock - can be fetched from hierarchy
          managerEmail: 'manager@example.com',
          managerAvatar: undefined
        };
      });

      setStaffs(staffsData);
      
      // Auto-select first staff
      if (staffsData.length > 0 && !selectedStaff) {
        setSelectedStaff(staffsData[0]);
      }
    } catch (error) {
      // Error handled - show empty state
      setStaffs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffSelect = (staff: Staff) => {
    setSelectedStaff(staff);
  };

  // Pagination
  const totalPages = Math.ceil(staffs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStaffs = staffs.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="modern-staff-loading">
        <div className="loading-spinner"></div>
        <p>Loading staff data...</p>
      </div>
    );
  }

  return (
    <div className="modern-staff-container">
      <div className="modern-staff-layout">
        {/* Left Panel - Staff List (70%) */}
        <div className="staff-list-panel">
          <div className="staff-list-header">
            <h2>Staff</h2>
            <span className="staff-count">{staffs.length} employees</span>
          </div>

          <div className="staff-list-table">
            <div className="staff-list-header-row">
              <div className="staff-col-name">Name</div>
              <div className="staff-col-dept">Department</div>
              <div className="staff-col-designation">Designation</div>
              <div className="staff-col-leaves">Total Leaves</div>
              <div className="staff-col-salary">Salary</div>
            </div>

            <div className="staff-list-body">
              {currentStaffs.map((staff) => (
                <div
                  key={staff.id}
                  className={`staff-list-row ${selectedStaff?.id === staff.id ? 'selected' : ''}`}
                  onClick={() => handleStaffSelect(staff)}
                >
                  <div className="staff-col-name">
                    <div className="staff-name-cell">
                      {staff.profileImageUrl ? (
                        <img 
                          src={staff.profileImageUrl} 
                          alt={staff.name}
                          className="staff-avatar-small"
                        />
                      ) : (
                        <div className="staff-avatar-placeholder-small">
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{staff.name}</span>
                    </div>
                  </div>
                  <div className="staff-col-dept">{staff.department}</div>
                  <div className="staff-col-designation">{staff.designation}</div>
                  <div className="staff-col-leaves">{staff.totalLeaves}</div>
                  <div className="staff-col-salary">${staff.netSalary.toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="staff-pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Staff Details (30%) */}
        <div className="staff-details-panel">
          {selectedStaff ? (
            <StaffDetailsView staff={selectedStaff} />
          ) : (
            <div className="no-staff-selected">
              <p>Select a staff member to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Staff Details Component
const StaffDetailsView = ({ staff }: { staff: Staff }) => {
  const totalLeavesPercentage = staff.annualLeaves > 0 
    ? Math.round((staff.annualLeavesUsed / staff.annualLeaves) * 100) 
    : 0;
  
  const sickLeavesPercentage = staff.sickLeaves > 0 
    ? Math.round((staff.sickLeavesUsed / staff.sickLeaves) * 100) 
    : 0;

  const annualProgress = (staff.annualLeavesUsed / staff.annualLeaves) * 100;
  const sickProgress = (staff.sickLeavesUsed / staff.sickLeaves) * 100;
  const emergencyProgress = staff.emergencyLeaves > 0 
    ? (staff.emergencyLeavesUsed / staff.emergencyLeaves) * 100 
    : 0;

  return (
    <div className="staff-details-content">
      {/* Staff Name */}
      <div className="staff-details-header">
        <div className="staff-details-avatar">
          {staff.profileImageUrl ? (
            <img 
              src={staff.profileImageUrl} 
              alt={staff.name}
              className="staff-avatar-large"
            />
          ) : (
            <div className="staff-avatar-placeholder-large">
              {staff.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <h1 className="staff-details-name">{staff.name}</h1>
        <p className="staff-details-designation">{staff.designation}</p>
      </div>

      {/* Summary Section with Circular Indicators */}
      <div className="staff-summary-section">
        <div className="summary-card">
          <div className="circular-progress">
            <svg className="progress-ring" width="80" height="80">
              <circle
                className="progress-ring-background"
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="6"
              />
              <circle
                className="progress-ring-progress"
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="#f97316"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset={`${2 * Math.PI * 35 * (1 - totalLeavesPercentage / 100)}`}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="progress-text">
              <span className="progress-value">{totalLeavesPercentage}%</span>
              <span className="progress-label">Total Leaves</span>
            </div>
          </div>
          <div className="circular-progress">
            <svg className="progress-ring" width="80" height="80">
              <circle
                className="progress-ring-background"
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="6"
              />
              <circle
                className="progress-ring-progress"
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="#f97316"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset={`${2 * Math.PI * 35 * (1 - sickLeavesPercentage / 100)}`}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="progress-text">
              <span className="progress-value">{sickLeavesPercentage}%</span>
              <span className="progress-label">Sick Leaves</span>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Breakdown */}
      <div className="staff-section">
        <h3 className="section-title">Leave Breakdown</h3>
        <div className="leave-progress-item">
          <div className="leave-progress-header">
            <span>Annual Leaves</span>
            <span>{staff.annualLeavesUsed} / {staff.annualLeaves}</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar orange"
              style={{ width: `${Math.min(annualProgress, 100)}%` }}
            ></div>
          </div>
        </div>
        <div className="leave-progress-item">
          <div className="leave-progress-header">
            <span>Sick Leaves</span>
            <span>{staff.sickLeavesUsed} / {staff.sickLeaves}</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar orange"
              style={{ width: `${Math.min(sickProgress, 100)}%` }}
            ></div>
          </div>
        </div>
        <div className="leave-progress-item">
          <div className="leave-progress-header">
            <span>Emergency Leaves</span>
            <span>{staff.emergencyLeavesUsed} / {staff.emergencyLeaves}</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar orange"
              style={{ width: `${Math.min(emergencyProgress, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Salary Details */}
      <div className="staff-section">
        <h3 className="section-title">Salary Details</h3>
        <div className="salary-details-grid">
          <div className="salary-item">
            <span className="salary-label">Monthly Salary</span>
            <span className="salary-value">${staff.monthlySalary.toLocaleString()}</span>
          </div>
          <div className="salary-item">
            <span className="salary-label">Allowances</span>
            <span className="salary-value positive">+${staff.allowances.toLocaleString()}</span>
          </div>
          <div className="salary-item">
            <span className="salary-label">Deductions</span>
            <span className="salary-value negative">-${staff.deductions.toLocaleString()}</span>
          </div>
          <div className="salary-item total">
            <span className="salary-label">Net Salary</span>
            <span className="salary-value total">${staff.netSalary.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Personal Details */}
      <div className="staff-section">
        <h3 className="section-title">Personal Details</h3>
        <div className="personal-details-list">
          <div className="detail-item">
            <span className="detail-label">Email</span>
            <span className="detail-value">{staff.email || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Phone</span>
            <span className="detail-value">{staff.phone || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Department</span>
            <span className="detail-value">{staff.department}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Joining Date</span>
            <span className="detail-value">
              {staff.joinDate 
                ? new Date(staff.joinDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Manager / Reporting Person */}
      {staff.managerName && (
        <div className="staff-section">
          <h3 className="section-title">Reporting Manager</h3>
          <div className="manager-card">
            <div className="manager-avatar">
              {staff.managerAvatar ? (
                <img src={staff.managerAvatar} alt={staff.managerName} />
              ) : (
                <div className="manager-avatar-placeholder">
                  {staff.managerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="manager-info">
              <div className="manager-name">{staff.managerName}</div>
              <div className="manager-email">{staff.managerEmail || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernStaffManagement;

