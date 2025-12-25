import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin } from '../../utils/userRole';
import Icon from '../../components/Icons';
import './EmployeeProfileView.css';

interface EmployeeData {
  employeeId?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  role?: string;
  dutyHours?: string;
  joinDate?: string;
  status?: string;
  gender?: string;
  dateOfBirth?: string;
  age?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  employeeType?: string;
  salary?: string;
  yearsOfExperience?: string;
  qidNumber?: string;
  qidExpiryDate?: string;
  passportValidityDate?: string;
  drivingLicenseValidityDate?: string;
  accommodation?: string;
  familyStatus?: string;
  sponsorship?: string;
  medicalDesignation?: string;
  medicalLicenseNumber?: string;
  workplaceName?: string;
  licenseValidityDate?: string;
  authUserId?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

const EmployeeProfileView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [error, setError] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingRole, setEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [employeeDocId, setEmployeeDocId] = useState<string>('');
  const [employeeCollection, setEmployeeCollection] = useState<'employees' | 'staffs'>('employees');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState<EmployeeData | null>(null);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        try {
          // Fetch user role
          const role = await fetchUserRole(user.uid);
          setCurrentUserRole(role);
          setIsAdmin(role.toLowerCase() === 'admin' || role.toLowerCase() === 'administrator');
          
          // Fetch employee data if id is available
          if (id) {
            fetchEmployeeData(id, user.uid, role);
          }
        } catch (error) {
          console.error('Error fetching current user role:', error);
          setCurrentUserRole('employee');
          setIsAdmin(false);
          if (id) {
            fetchEmployeeData(id, user.uid, 'employee');
          }
        }
      } else {
        setCurrentUserId('');
        setCurrentUserRole('');
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchEmployeeData = async (id: string, userId: string, userRole: string) => {
    try {
      setLoading(true);
      setError('');

      const adminUser = isAdmin(userRole);
      let employeeDocIdFound = '';
      let employeeCollectionFound: 'employees' | 'staffs' = 'employees';
      let employeeDataFound: EmployeeData | null = null;

      // Optimize: Try most common scenarios first in parallel
      // 1. Try document ID lookups in parallel (most likely to succeed)
      const [employeeDocResult, staffDocResult] = await Promise.all([
        getDoc(doc(db, 'employees', id)).catch(() => null),
        getDoc(doc(db, 'staffs', id)).catch(() => null)
      ]);

      if (employeeDocResult?.exists()) {
        const data = employeeDocResult.data() as EmployeeData;
        employeeDocIdFound = employeeDocResult.id;
        employeeCollectionFound = 'employees';
        employeeDataFound = data;
      } else if (staffDocResult?.exists()) {
        const data = staffDocResult.data() as EmployeeData;
        employeeDocIdFound = staffDocResult.id;
        employeeCollectionFound = 'staffs';
        employeeDataFound = data;
      } else {
        // 2. If not found by document ID, try searching by employeeId field in parallel
        const [employeesSnapshot, staffsSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'employees'), where('employeeId', '==', id))).catch(() => null),
          getDocs(query(collection(db, 'staffs'), where('employeeId', '==', id))).catch(() => null)
        ]);
        
        if (employeesSnapshot && !employeesSnapshot.empty) {
          const data = employeesSnapshot.docs[0].data() as EmployeeData;
          employeeDocIdFound = employeesSnapshot.docs[0].id;
          employeeCollectionFound = 'employees';
          employeeDataFound = data;
        } else if (staffsSnapshot && !staffsSnapshot.empty) {
          const data = staffsSnapshot.docs[0].data() as EmployeeData;
          employeeDocIdFound = staffsSnapshot.docs[0].id;
          employeeCollectionFound = 'staffs';
          employeeDataFound = data;
        }
      }

      if (!employeeDataFound) {
        setError('Employee not found');
        setLoading(false);
        return;
      }

      // Check access permission
      if (!adminUser) {
        // Non-admin users can only view their own profile
        const isOwnProfile = 
          employeeDocIdFound === userId || 
          employeeDataFound.authUserId === userId ||
          (employeeCollectionFound === 'employees' && employeeDocIdFound === userId);
        
        if (!isOwnProfile) {
          setError('Access denied. You can only view your own profile.');
          setLoading(false);
          return;
        }
      }

      // Fetch roles in parallel with setting state (non-blocking)
      const rolesPromise = fetchRoles();

      // Set the data immediately
      setEmployeeData(employeeDataFound);
      setEmployeeDocId(employeeDocIdFound);
      setEmployeeCollection(employeeCollectionFound);
      setSelectedRole(employeeDataFound.role || 'employee');
      
      // Wait for roles to finish (but it's non-blocking for UI)
      await rolesPromise;
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching employee data:', err);
      setError('Failed to load employee data');
      setLoading(false);
    }
  };

  const calculateAge = (dob: string | undefined): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const isMedicalDepartment = (): boolean => {
    const dept = displayData?.department || '';
    return ['Doctor', 'Nurse', 'Pharmacy'].includes(dept);
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const fetchRoles = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'roles'));
      if (!snapshot.empty) {
        const rolesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Role[];
        setRoles(rolesData);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'departments'));
      if (!snapshot.empty) {
        const departmentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        setDepartments(departmentsData);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const canEdit = (): boolean => {
    // Allow editing if user is admin or if they're viewing their own profile
    if (isAdmin) return true;
    if (employeeCollection === 'employees' && employeeDocId === currentUserId) return true;
    if (employeeData?.authUserId === currentUserId) return true;
    return false;
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset to original data
      setEditableData(null);
      setIsEditing(false);
    } else {
      // Start editing - create editable copy
      setEditableData({ ...employeeData });
      setIsEditing(true);
      fetchDepartments();
    }
  };

  const handleFieldChange = (field: keyof EmployeeData, value: any) => {
    if (!editableData) return;
    
    const updated = { ...editableData, [field]: value };
    
    // Auto-calculate age if dateOfBirth changes
    if (field === 'dateOfBirth') {
      updated.age = calculateAge(value);
    }
    
    // If department changes, clear medical fields if switching to non-medical department
    if (field === 'department') {
      const medicalDepts = ['Doctor', 'Nurse', 'Pharmacy'];
      const wasMedical = medicalDepts.includes(editableData.department || '');
      const isMedical = medicalDepts.includes(value);
      
      // If switching from medical to non-medical, clear medical fields
      if (wasMedical && !isMedical) {
        updated.medicalDesignation = '';
        updated.medicalLicenseNumber = '';
        updated.workplaceName = '';
        updated.licenseValidityDate = '';
      }
    }
    
    setEditableData(updated);
  };

  const handleSave = async () => {
    if (!editableData || !employeeDocId) return;

    setSaving(true);
    setError('');

    try {
      // Prepare update data (exclude read-only fields)
      const updateData: any = {
        ...editableData,
        updatedAt: new Date()
      };

      // Remove fields that shouldn't be updated
      delete updateData.employeeId; // Read-only
      delete updateData.email; // Read-only
      delete updateData.id;

      // Remove medical fields if department is not medical
      const medicalDepts = ['Doctor', 'Nurse', 'Pharmacy'];
      if (!medicalDepts.includes(updateData.department || '')) {
        delete updateData.medicalDesignation;
        delete updateData.medicalLicenseNumber;
        delete updateData.workplaceName;
        delete updateData.licenseValidityDate;
      }

      // Update in the current collection
      await updateDoc(doc(db, employeeCollection, employeeDocId), updateData);

      // Also update in staffs collection if it exists in employees
      if (employeeCollection === 'employees') {
        // Try to find corresponding staff document
        const staffQuery = query(
          collection(db, 'staffs'),
          where('employeeId', '==', editableData.employeeId)
        );
        const staffSnapshot = await getDocs(staffQuery);
        if (!staffSnapshot.empty) {
          await updateDoc(doc(db, 'staffs', staffSnapshot.docs[0].id), {
            name: editableData.fullName || editableData.name,
            email: editableData.email,
            phone: editableData.phone,
            department: editableData.department,
            position: editableData.position,
            role: editableData.role,
            updatedAt: new Date()
          });
        }
      }

      // Update local state
      setEmployeeData(editableData);
      setIsEditing(false);
      setEditableData(null);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setError(error.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!employeeDocId || !selectedRole) return;

    setSavingRole(true);
    try {
      // Update in the current collection (employees or staffs)
      await updateDoc(doc(db, employeeCollection, employeeDocId), {
        role: selectedRole,
        updatedAt: new Date()
      });

      // Also update in userRoles collection
      // If authUserId exists in data, use it; otherwise, if from employees collection, use doc ID
      const userId = employeeData?.authUserId || (employeeCollection === 'employees' ? employeeDocId : null);
      if (userId) {
        try {
          await updateDoc(doc(db, 'userRoles', userId), {
            role: selectedRole,
            updatedAt: new Date()
          });
        } catch (err: any) {
          // If document doesn't exist, create it
          if (err.code === 'not-found') {
            await setDoc(doc(db, 'userRoles', userId), {
              role: selectedRole,
              email: employeeData?.email || '',
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      } else if (employeeCollection === 'employees') {
        // If it's from employees collection, the document ID is the authUserId
        try {
          await updateDoc(doc(db, 'userRoles', employeeDocId), {
            role: selectedRole,
            updatedAt: new Date()
          });
        } catch (err) {
          // If userRoles document doesn't exist, create it
          console.log('UserRoles document not found, creating new one');
        }
      }

      // Update local state
      setEmployeeData(prev => prev ? { ...prev, role: selectedRole } : null);
      setEditingRole(false);
    } catch (error) {
      console.error('Error updating role:', error);
      setError('Failed to update role. Please try again.');
    } finally {
      setSavingRole(false);
    }
  };

  if (loading) {
    return (
      <div className="full-page">
        <div className="employee-profile-view">
          <div className="loading-skeleton">
            <div className="skeleton-header"></div>
            <div className="skeleton-section"></div>
            <div className="skeleton-section"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !employeeData) {
    return (
      <div className="full-page">
        <div className="employee-profile-view">
          <div className="error-state">
            <h2>Error</h2>
            <p>{error || 'Employee data not found'}</p>
            <button className="btn-back" onClick={() => navigate('/staffs/management')}>
          <Icon name="chevron-left" /> Back to Staff Management
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use editableData if in edit mode, otherwise use employeeData
  const displayData = isEditing && editableData ? editableData : employeeData;
  const age = displayData ? (displayData.age || calculateAge(displayData.dateOfBirth)) : 0;
  const displayName = displayData ? (displayData.fullName || displayData.name || 'N/A') : 'N/A';

  return (
    <div className="full-page">
      <div className="employee-profile-view">
        <div className="profile-header">
          <button className="btn-back" onClick={() => navigate('/staffs/management')}>
            <Icon name="chevron-left" /> Back
          </button>
          <h1>Employee Profile</h1>
          {canEdit() && (
            <div className="profile-actions">
              {isEditing ? (
                <>
                  <button
                    className="btn-cancel"
                    onClick={handleEditToggle}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-save"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  className="btn-edit"
                  onClick={handleEditToggle}
                >
                  <Icon name="edit" />
                  Edit Profile
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '20px', padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <div className="profile-content">
          {/* Section 1: Basic Information */}
          <div className="profile-section">
            <div className="section-header">
              <Icon name="grid" />
              <h2>Basic Information</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <div className="info-item">
                  <label>Employee ID</label>
                  <div className="info-value">{employeeData.employeeId || 'N/A'}</div>
                </div>
                <div className="info-item">
                  <label>Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="info-input"
                      value={editableData?.fullName || editableData?.name || ''}
                      onChange={(e) => handleFieldChange('fullName', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayName}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Email</label>
                  <div className="info-value read-only">{displayData?.email || 'N/A'}</div>
                </div>
                <div className="info-item">
                  <label>Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      className="info-input"
                      value={editableData?.phone || ''}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.phone || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Department</label>
                  {isEditing ? (
                    <select
                      className="info-input"
                      value={editableData?.department || ''}
                      onChange={(e) => handleFieldChange('department', e.target.value)}
                      disabled={saving || departments.length === 0}
                    >
                      <option value="">{departments.length === 0 ? 'Loading...' : 'Select Department'}</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="info-value">{displayData?.department || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Position</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="info-input"
                      value={editableData?.position || ''}
                      onChange={(e) => handleFieldChange('position', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.position || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Role</label>
                  {editingRole && isAdmin ? (
                    <div className="role-edit-container">
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="role-select"
                        disabled={savingRole}
                      >
                        <option value="">Select Role</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.name}>{role.name}</option>
                        ))}
                      </select>
                      <div className="role-edit-actions">
                        <button
                          className="btn-save-role"
                          onClick={handleRoleChange}
                          disabled={savingRole || !selectedRole}
                        >
                          {savingRole ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="btn-cancel-role"
                          onClick={() => {
                            setEditingRole(false);
                            setSelectedRole(displayData?.role || 'employee');
                          }}
                          disabled={savingRole}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="info-value role-display">
                      {displayData?.role || 'employee'}
                      {isAdmin && (
                        <button
                          className="btn-edit-role"
                          onClick={() => setEditingRole(true)}
                          title="Edit Role"
                        >
                          <Icon name="edit" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="info-item">
                  <label>Duty Hours</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="info-input"
                      value={editableData?.dutyHours || ''}
                      onChange={(e) => handleFieldChange('dutyHours', e.target.value)}
                      placeholder="e.g., 9 AM - 5 PM"
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.dutyHours || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Joining Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      className="info-input"
                      value={editableData?.joinDate ? editableData.joinDate.split('T')[0] : ''}
                      onChange={(e) => handleFieldChange('joinDate', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{formatDate(displayData?.joinDate)}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Status</label>
                  {isEditing ? (
                    <select
                      className="info-input"
                      value={editableData?.status || 'active'}
                      onChange={(e) => handleFieldChange('status', e.target.value)}
                      disabled={saving}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="on-leave">On Leave</option>
                    </select>
                  ) : (
                    <div className={`info-value status-badge ${displayData?.status || 'active'}`}>
                      {displayData?.status || 'Active'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Personal Details */}
          <div className="profile-section">
            <div className="section-header">
              <Icon name="users" />
              <h2>Personal Details</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <div className="info-item">
                  <label>Gender</label>
                  {isEditing ? (
                    <select
                      className="info-input"
                      value={editableData?.gender || ''}
                      onChange={(e) => handleFieldChange('gender', e.target.value)}
                      disabled={saving}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <div className="info-value">{displayData?.gender || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Date of Birth</label>
                  {isEditing ? (
                    <input
                      type="date"
                      className="info-input"
                      value={editableData?.dateOfBirth ? editableData.dateOfBirth.split('T')[0] : ''}
                      onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{formatDate(displayData?.dateOfBirth)}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Age</label>
                  <div className="info-value read-only">{age > 0 ? `${age} years` : 'N/A'}</div>
                </div>
                <div className="info-item">
                  <label>Emergency Contact Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="info-input"
                      value={editableData?.emergencyContactName || ''}
                      onChange={(e) => handleFieldChange('emergencyContactName', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.emergencyContactName || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Emergency Contact Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      className="info-input"
                      value={editableData?.emergencyContactPhone || ''}
                      onChange={(e) => handleFieldChange('emergencyContactPhone', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.emergencyContactPhone || 'N/A'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Professional Information */}
          <div className="profile-section">
            <div className="section-header">
              <Icon name="dollar-sign" />
              <h2>Professional Information</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <div className="info-item">
                  <label>Employee Type</label>
                  {isEditing ? (
                    <select
                      className="info-input"
                      value={editableData?.employeeType || ''}
                      onChange={(e) => handleFieldChange('employeeType', e.target.value)}
                      disabled={saving}
                    >
                      <option value="">Select Type</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                    </select>
                  ) : (
                    <div className="info-value">{displayData?.employeeType || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Salary</label>
                  {isEditing ? (
                    <input
                      type="number"
                      className="info-input"
                      value={editableData?.salary || ''}
                      onChange={(e) => handleFieldChange('salary', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.salary || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Years of Experience</label>
                  {isEditing ? (
                    <input
                      type="number"
                      className="info-input"
                      value={editableData?.yearsOfExperience || ''}
                      onChange={(e) => handleFieldChange('yearsOfExperience', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.yearsOfExperience || 'N/A'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Document Information */}
          <div className="profile-section">
            <div className="section-header">
              <Icon name="file-text" />
              <h2>Document Information</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <div className="info-item">
                  <label>QID Number</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="info-input"
                      value={editableData?.qidNumber || ''}
                      onChange={(e) => handleFieldChange('qidNumber', e.target.value)}
                      maxLength={11}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.qidNumber || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>QID Expiry Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      className="info-input"
                      value={editableData?.qidExpiryDate ? editableData.qidExpiryDate.split('T')[0] : ''}
                      onChange={(e) => handleFieldChange('qidExpiryDate', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{formatDate(displayData?.qidExpiryDate)}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Passport Validity Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      className="info-input"
                      value={editableData?.passportValidityDate ? editableData.passportValidityDate.split('T')[0] : ''}
                      onChange={(e) => handleFieldChange('passportValidityDate', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{formatDate(displayData?.passportValidityDate)}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Driving License Validity Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      className="info-input"
                      value={editableData?.drivingLicenseValidityDate ? editableData.drivingLicenseValidityDate.split('T')[0] : ''}
                      onChange={(e) => handleFieldChange('drivingLicenseValidityDate', e.target.value)}
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{formatDate(displayData?.drivingLicenseValidityDate)}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Qatar Information */}
          <div className="profile-section">
            <div className="section-header">
              <Icon name="settings" />
              <h2>Qatar Information</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <div className="info-item">
                  <label>Accommodation</label>
                  {isEditing ? (
                    <select
                      className="info-input"
                      value={editableData?.accommodation || ''}
                      onChange={(e) => handleFieldChange('accommodation', e.target.value)}
                      disabled={saving}
                    >
                      <option value="">Select Option</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  ) : (
                    <div className="info-value">{displayData?.accommodation || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Family Status</label>
                  {isEditing ? (
                    <select
                      className="info-input"
                      value={editableData?.familyStatus || ''}
                      onChange={(e) => handleFieldChange('familyStatus', e.target.value)}
                      disabled={saving}
                    >
                      <option value="">Select Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                    </select>
                  ) : (
                    <div className="info-value">{displayData?.familyStatus || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Sponsorship</label>
                  {isEditing ? (
                    <select
                      className="info-input"
                      value={editableData?.sponsorship || ''}
                      onChange={(e) => handleFieldChange('sponsorship', e.target.value)}
                      disabled={saving}
                    >
                      <option value="">Select Type</option>
                      <option value="Company">Company</option>
                      <option value="Personal">Personal</option>
                      <option value="Family">Family</option>
                    </select>
                  ) : (
                    <div className="info-value">{displayData?.sponsorship || 'N/A'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Medical Information (Conditional) */}
          {isMedicalDepartment() && (
            <div className="profile-section medical-section">
              <div className="section-header">
                <Icon name="alert-circle" />
                <h2>Medical Information</h2>
              </div>
              <div className="section-content">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Medical Designation</label>
                    {isEditing ? (
                      <input
                        type="text"
                        className="info-input"
                        value={editableData?.medicalDesignation || ''}
                        onChange={(e) => handleFieldChange('medicalDesignation', e.target.value)}
                        disabled={saving}
                      />
                    ) : (
                      <div className="info-value">{displayData?.medicalDesignation || 'N/A'}</div>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Medical License Number</label>
                    {isEditing ? (
                      <input
                        type="text"
                        className="info-input"
                        value={editableData?.medicalLicenseNumber || ''}
                        onChange={(e) => handleFieldChange('medicalLicenseNumber', e.target.value)}
                        disabled={saving}
                      />
                    ) : (
                      <div className="info-value">{displayData?.medicalLicenseNumber || 'N/A'}</div>
                    )}
                  </div>
                  <div className="info-item">
                    <label>Workplace / Hospital / Clinic Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        className="info-input"
                        value={editableData?.workplaceName || ''}
                        onChange={(e) => handleFieldChange('workplaceName', e.target.value)}
                        disabled={saving}
                      />
                    ) : (
                      <div className="info-value">{displayData?.workplaceName || 'N/A'}</div>
                    )}
                  </div>
                  <div className="info-item">
                    <label>License Validity Date</label>
                    {isEditing ? (
                      <input
                        type="date"
                        className="info-input"
                        value={editableData?.licenseValidityDate ? editableData.licenseValidityDate.split('T')[0] : ''}
                        onChange={(e) => handleFieldChange('licenseValidityDate', e.target.value)}
                        disabled={saving}
                      />
                    ) : (
                      <div className="info-value">{formatDate(displayData?.licenseValidityDate)}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfileView;

