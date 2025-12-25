import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../firebase/config';
import Icon from '../components/Icons';
import './Profile.css';

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
  profileImageUrl?: string;
  qidImageUrl?: string;
  passportImageUrl?: string;
  medicalLicenseImageUrl?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [error, setError] = useState('');
  const [_roles, setRoles] = useState<Role[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState<EmployeeData | null>(null);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [employeeDocId, setEmployeeDocId] = useState<string>('');
  const [employeeCollection, setEmployeeCollection] = useState<'employees' | 'staffs'>('employees');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [qidImage, setQidImage] = useState<File | null>(null);
  const [passportImage, setPassportImage] = useState<File | null>(null);
  const [medicalLicenseImage, setMedicalLicenseImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');
  const [qidImagePreview, setQidImagePreview] = useState<string>('');
  const [passportImagePreview, setPassportImagePreview] = useState<string>('');
  const [medicalLicenseImagePreview, setMedicalLicenseImagePreview] = useState<string>('');
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        await fetchEmployeeData(user.uid);
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchEmployeeData = async (uid: string) => {
    try {
      setLoading(true);
      setError('');

      // First, try to fetch from employees collection
      const employeeDoc = await getDoc(doc(db, 'employees', uid));
      if (employeeDoc.exists()) {
        const data = employeeDoc.data() as EmployeeData;
        setEmployeeData(data);
        setEmployeeDocId(employeeDoc.id);
        setEmployeeCollection('employees');
        await fetchRoles();
        await fetchDepartments();
        setLoading(false);
        return;
      }

      // If not found in employees, try staffs collection by authUserId
      const staffsQuery = query(
        collection(db, 'staffs'),
        where('authUserId', '==', uid)
      );
      const staffsSnapshot = await getDocs(staffsQuery);
      
      if (!staffsSnapshot.empty) {
        const data = staffsSnapshot.docs[0].data() as EmployeeData;
        setEmployeeData(data);
        setEmployeeDocId(staffsSnapshot.docs[0].id);
        setEmployeeCollection('staffs');
        await fetchRoles();
        await fetchDepartments();
        setLoading(false);
        return;
      }

      // If still not found, show error
      setError('Profile not found. Please complete your profile first.');
      setLoading(false);
    } catch (err) {
      console.error('Error fetching employee data:', err);
      setError('Failed to load profile data');
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

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset to original data
      setEditableData(null);
      setIsEditing(false);
      // Reset image previews
      setProfileImagePreview('');
      setQidImagePreview('');
      setPassportImagePreview('');
      setMedicalLicenseImagePreview('');
      setProfileImage(null);
      setQidImage(null);
      setPassportImage(null);
      setMedicalLicenseImage(null);
    } else {
      // Start editing - create editable copy
      setEditableData({ ...employeeData });
      setIsEditing(true);
      fetchDepartments();
      // Set existing image previews if available
      if (employeeData?.profileImageUrl) {
        setProfileImagePreview(employeeData.profileImageUrl);
      }
      if (employeeData?.qidImageUrl) {
        setQidImagePreview(employeeData.qidImageUrl);
      }
      if (employeeData?.passportImageUrl) {
        setPassportImagePreview(employeeData.passportImageUrl);
      }
      if (employeeData?.medicalLicenseImageUrl) {
        setMedicalLicenseImagePreview(employeeData.medicalLicenseImageUrl);
      }
    }
  };

  const handleFieldChange = (field: keyof EmployeeData, value: any) => {
    if (!editableData) return;
    
    // Validate Emergency Contact Name - characters only (letters and spaces)
    if (field === 'emergencyContactName') {
      // Only allow letters, spaces, hyphens, and apostrophes
      const charOnlyRegex = /^[a-zA-Z\s'-]*$/;
      if (value && !charOnlyRegex.test(value)) {
        setError('Emergency Contact Name can only contain letters, spaces, hyphens, and apostrophes');
        return;
      }
      setError(''); // Clear error if valid
    }
    
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
        updated.medicalLicenseImageUrl = '';
      }
    }
    
    setEditableData(updated);
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'qid' | 'passport' | 'medicalLicense') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (type === 'profile') {
        setProfileImagePreview(result);
        setProfileImage(file);
      } else if (type === 'qid') {
        setQidImagePreview(result);
        setQidImage(file);
      } else if (type === 'passport') {
        setPassportImagePreview(result);
        setPassportImage(file);
      } else if (type === 'medicalLicense') {
        setMedicalLicenseImagePreview(result);
        setMedicalLicenseImage(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!editableData || !employeeDocId) return;

    setSaving(true);
    setError('');

    // Validate mandatory fields
    const missingFields: string[] = [];
    if (!editableData.salary) missingFields.push('Salary');
    if (!editableData.qidNumber) missingFields.push('QID Number');
    if (!editableData.qidExpiryDate) missingFields.push('QID Expiry Date');
    if (!editableData.passportValidityDate) missingFields.push('Passport Validity Date');
    if (!editableData.qidImageUrl && !qidImage) missingFields.push('QID Image');
    if (!editableData.passportImageUrl && !passportImage) missingFields.push('Passport Image');

    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
      setSaving(false);
      return;
    }

    try {
      // Upload images first if new ones are selected
      setUploadingImages(true);
      let profileImageUrl = editableData.profileImageUrl || '';
      let qidImageUrl = editableData.qidImageUrl || '';
      let passportImageUrl = editableData.passportImageUrl || '';
      let medicalLicenseImageUrl = editableData.medicalLicenseImageUrl || '';

      try {
        if (profileImage) {
          profileImageUrl = await uploadImage(profileImage, `profiles/${currentUserId}/profile.jpg`);
        }
        if (qidImage) {
          qidImageUrl = await uploadImage(qidImage, `documents/${currentUserId}/qid.jpg`);
        }
        if (passportImage) {
          passportImageUrl = await uploadImage(passportImage, `documents/${currentUserId}/passport.jpg`);
        }
        if (medicalLicenseImage) {
          medicalLicenseImageUrl = await uploadImage(medicalLicenseImage, `documents/${currentUserId}/medical-license.jpg`);
        }
      } catch (uploadError: any) {
        console.error('Error uploading images:', uploadError);
        setError('Failed to upload images. Please try again.');
        setSaving(false);
        setUploadingImages(false);
        return;
      }
      
      setUploadingImages(false);

      // Prepare update data (exclude read-only fields)
      const updateData: any = {
        ...editableData,
        profileImageUrl,
        qidImageUrl,
        passportImageUrl,
        medicalLicenseImageUrl,
        updatedAt: new Date()
      };

      // Remove fields that shouldn't be updated
      delete updateData.employeeId; // Read-only
      delete updateData.email; // Read-only
      delete updateData.role; // Role can only be changed by admin
      delete updateData.id;

      // Remove medical fields if department is not medical
      const medicalDepts = ['Doctor', 'Nurse', 'Pharmacy'];
      if (!medicalDepts.includes(updateData.department || '')) {
        delete updateData.medicalDesignation;
        delete updateData.medicalLicenseNumber;
        delete updateData.workplaceName;
        delete updateData.licenseValidityDate;
        delete updateData.medicalLicenseImageUrl;
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

  if (loading) {
    return (
      <div className="full-page">
        <div className="profile-page">
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
        <div className="profile-page">
          <div className="error-state">
            <h2>Error</h2>
            <p>{error || 'Profile data not found'}</p>
            <button className="btn-back" onClick={() => navigate('/')}>
            <Icon name="chevron-left" /> Back to Dashboard
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
      <div className="profile-page">
        <div className="profile-header">
          <h1>My Profile</h1>
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
                  disabled={saving || uploadingImages}
                >
                  {uploadingImages ? 'Uploading Images...' : saving ? 'Saving...' : 'Save Changes'}
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
                  <label>Profile Image</label>
                  {isEditing ? (
                    <div className="image-upload-container">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageChange(e, 'profile')}
                        className="image-input"
                        id="profile-image-profile"
                        disabled={saving}
                      />
                      <label htmlFor="profile-image-profile" className="image-upload-label profile-image-label">
                        {profileImagePreview ? (
                          <img src={profileImagePreview} alt="Profile preview" className="image-preview profile-preview" />
                        ) : (
                          <div className="image-upload-placeholder">
                            <span>+</span>
                            <p>{displayData?.profileImageUrl ? 'Change Profile Image' : 'Upload Profile Image'}</p>
                          </div>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="info-value">
                      {displayData?.profileImageUrl ? (
                        <img src={displayData.profileImageUrl} alt="Profile" className="profile-display-image" />
                      ) : (
                        <div className="profile-placeholder">
                          <Icon name="users" />
                          <span>No Profile Image</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="info-item">
                  <label>Employee ID</label>
                  <div className="info-value read-only">{displayData?.employeeId || 'N/A'}</div>
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
                  <div className="info-value read-only">{displayData?.role || 'employee'}</div>
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
                      pattern="[a-zA-Z\s'-]*"
                      title="Only letters, spaces, hyphens, and apostrophes are allowed"
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
                  <label>Salary *</label>
                  {isEditing ? (
                    <input
                      type="number"
                      className="info-input"
                      value={editableData?.salary || ''}
                      onChange={(e) => handleFieldChange('salary', e.target.value)}
                      required
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
                  <label>QID Number *</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="info-input"
                      value={editableData?.qidNumber || ''}
                      onChange={(e) => handleFieldChange('qidNumber', e.target.value)}
                      maxLength={11}
                      required
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{displayData?.qidNumber || 'N/A'}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>QID Expiry Date *</label>
                  {isEditing ? (
                    <input
                      type="date"
                      className="info-input"
                      value={editableData?.qidExpiryDate ? editableData.qidExpiryDate.split('T')[0] : ''}
                      onChange={(e) => handleFieldChange('qidExpiryDate', e.target.value)}
                      required
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{formatDate(displayData?.qidExpiryDate)}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>QID Image *</label>
                  {isEditing ? (
                    <div className="image-upload-container">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageChange(e, 'qid')}
                        className="image-input"
                        id="qid-image-profile"
                        disabled={saving}
                      />
                      <label htmlFor="qid-image-profile" className="image-upload-label">
                        {qidImagePreview ? (
                          <img src={qidImagePreview} alt="QID preview" className="image-preview" />
                        ) : (
                          <div className="image-upload-placeholder">
                            <span>+</span>
                            <p>{displayData?.qidImageUrl ? 'Change QID Image' : 'Upload QID Image'}</p>
                          </div>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="info-value">
                      {displayData?.qidImageUrl ? (
                        <img src={displayData.qidImageUrl} alt="QID" className="document-preview-image" />
                      ) : (
                        <span className="no-image-text">No QID Image</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="info-item">
                  <label>Passport Validity Date *</label>
                  {isEditing ? (
                    <input
                      type="date"
                      className="info-input"
                      value={editableData?.passportValidityDate ? editableData.passportValidityDate.split('T')[0] : ''}
                      onChange={(e) => handleFieldChange('passportValidityDate', e.target.value)}
                      required
                      disabled={saving}
                    />
                  ) : (
                    <div className="info-value">{formatDate(displayData?.passportValidityDate)}</div>
                  )}
                </div>
                <div className="info-item">
                  <label>Passport Image *</label>
                  {isEditing ? (
                    <div className="image-upload-container">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageChange(e, 'passport')}
                        className="image-input"
                        id="passport-image-profile"
                        disabled={saving}
                      />
                      <label htmlFor="passport-image-profile" className="image-upload-label">
                        {passportImagePreview ? (
                          <img src={passportImagePreview} alt="Passport preview" className="image-preview" />
                        ) : (
                          <div className="image-upload-placeholder">
                            <span>+</span>
                            <p>{displayData?.passportImageUrl ? 'Change Passport Image' : 'Upload Passport Image'}</p>
                          </div>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="info-value">
                      {displayData?.passportImageUrl ? (
                        <img src={displayData.passportImageUrl} alt="Passport" className="document-preview-image" />
                      ) : (
                        <span className="no-image-text">No Passport Image</span>
                      )}
                    </div>
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
                    <label>Medical License ID Number</label>
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
                    <label>Medical License Image</label>
                    {isEditing ? (
                      <div className="image-upload-container">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, 'medicalLicense')}
                          className="image-input"
                          id="medical-license-image-profile"
                          disabled={saving}
                        />
                        <label htmlFor="medical-license-image-profile" className="image-upload-label">
                          {medicalLicenseImagePreview ? (
                            <img src={medicalLicenseImagePreview} alt="Medical License preview" className="image-preview" />
                          ) : (
                            <div className="image-upload-placeholder">
                              <span>+</span>
                              <p>{displayData?.medicalLicenseImageUrl ? 'Change Medical License Image' : 'Upload Medical License Image'}</p>
                            </div>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className="info-value">
                        {displayData?.medicalLicenseImageUrl ? (
                          <img src={displayData.medicalLicenseImageUrl} alt="Medical License" className="document-preview-image" />
                        ) : (
                          <span className="no-image-text">No Medical License Image</span>
                        )}
                      </div>
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

export default Profile;

