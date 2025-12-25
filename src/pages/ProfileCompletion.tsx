import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import { doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import ImageCropper from '../components/ImageCropper';
import './ProfileCompletion.css';

interface ProfileData {
  // Auto-generated/read-only
  employeeId: string;
  email: string;
  role: string;
  joinDate: string;
  
  // Personal Information
  fullName: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  age: number;
  emergencyContactName: string;
  emergencyContactPhone: string;
  
  // Work Information
  department: string;
  dutyHours: string;
  position: string;
  employeeType: string;
  salary: string;
  yearsOfExperience: string;
  
  // Document Information
  qidNumber: string;
  qidExpiryDate: string;
  passportNumber?: string;
  passportValidityDate: string;
  drivingLicenseValidityDate: string;
  
  // Qatar-Specific Information
  accommodation: string;
  familyStatus: string;
  sponsorship: string;
  
  // Medical Staff Information (conditional)
  medicalDesignation?: string;
  medicalLicenseNumber?: string;
  workplaceName?: string;
  licenseValidityDate?: string;
  
  // Image URLs
  profileImageUrl?: string;
  qidImageUrl?: string;
  passportImageUrl?: string;
  medicalLicenseImageUrl?: string;
}

const ProfileCompletion = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [user, setUser] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [qidImage, setQidImage] = useState<File | null>(null);
  const [passportImage, setPassportImage] = useState<File | null>(null);
  const [medicalLicenseImage, setMedicalLicenseImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string>('');
  const [qidImagePreview, setQidImagePreview] = useState<string>('');
  const [passportImagePreview, setPassportImagePreview] = useState<string>('');
  const [medicalLicenseImagePreview, setMedicalLicenseImagePreview] = useState<string>('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const [userName, setUserName] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  const [formData, setFormData] = useState<ProfileData>({
    employeeId: '',
    email: '',
    role: 'employee',
    joinDate: new Date().toISOString().split('T')[0],
    fullName: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    age: 0,
    emergencyContactName: '',
    emergencyContactPhone: '',
    department: '',
    dutyHours: '',
    position: '',
    employeeType: '',
    salary: '',
    yearsOfExperience: '',
    qidNumber: '',
    qidExpiryDate: '',
    passportNumber: '',
    passportValidityDate: '',
    drivingLicenseValidityDate: '',
    accommodation: '',
    familyStatus: '',
    sponsorship: '',
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setFormData(prev => ({ ...prev, email: currentUser.email || '' }));
        
        // Extract name from email for welcome message
        const emailName = currentUser.email?.split('@')[0] || 'User';
        const formattedName = emailName
          .split(/[._-]/)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(' ');
        setUserName(formattedName);
        
        try {
          // Check if profile already completed
          const profileDoc = await getDoc(doc(db, 'employees', currentUser.uid));
          console.log('ProfileCompletion - Profile check:', {
            exists: profileDoc.exists(),
            profileCompleted: profileDoc.exists() ? profileDoc.data()?.profileCompleted : false
          });
          
          if (profileDoc.exists() && profileDoc.data()?.profileCompleted === true) {
            // Profile already completed, redirect to dashboard
            console.log('Profile already completed, redirecting...');
            navigate('/', { replace: true });
            return;
          }
          
          // Generate Employee ID
          console.log('Generating employee ID...');
          await generateEmployeeId();
          console.log('Fetching departments...');
          await fetchDepartments();
          setLoading(false);
        } catch (error) {
          console.error('Error initializing profile:', error);
          setError('Failed to initialize profile. Please refresh the page.');
          setLoading(false);
        }
      } else {
        // Not authenticated, redirect to login
        navigate('/login', { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const generateEmployeeId = async () => {
    try {
      // Get the highest existing employee ID from both EMP and FMC prefixes
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, orderBy('employeeId', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      
      let maxEmpNumber = 0;
      let maxFmcNumber = 0;
      
      if (!snapshot.empty) {
        snapshot.docs.forEach(doc => {
          const employeeId = doc.data().employeeId;
          if (employeeId) {
            // Check for EMP prefix
            if (employeeId.startsWith('EMP')) {
              const number = parseInt(employeeId.replace('EMP', ''), 10);
              if (!isNaN(number) && number > maxEmpNumber) {
                maxEmpNumber = number;
              }
            }
            // Check for FMC prefix
            if (employeeId.startsWith('FMC')) {
              const number = parseInt(employeeId.replace('FMC', ''), 10);
              if (!isNaN(number) && number > maxFmcNumber) {
                maxFmcNumber = number;
              }
            }
          }
        });
      }
      
      // Use the highest number from either prefix, then generate FMC ID
      const nextNumber = Math.max(maxEmpNumber, maxFmcNumber) + 1;
      const employeeId = `FMC${nextNumber.toString().padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, employeeId }));
    } catch (error) {
      console.error('Error generating employee ID:', error);
      setError('Failed to generate Employee ID. Please try again.');
    }
  };

  const fetchDepartments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'departments'));
      const depts = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setDepartments(depts);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'dateOfBirth') {
      const age = calculateAge(value);
      setFormData(prev => ({ ...prev, [name]: value, age }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };


  const isFormValid = (): boolean => {
    const requiredFields = [
      formData.fullName,
      formData.phone,
      formData.gender,
      formData.dateOfBirth,
      formData.department,
      formData.dutyHours,
      formData.position,
      formData.employeeType,
      formData.salary,
      formData.qidNumber,
      formData.accommodation,
      formData.familyStatus,
      formData.sponsorship,
    ];

    // QID and Passport images are mandatory
    if (!qidImage || !passportImage) {
      return false;
    }

    // Terms and conditions agreement is mandatory
    if (!agreeToTerms) {
      return false;
    }

    // Medical fields are NOT mandatory - they are optional for all users
    return requiredFields.every(field => field);
  };

  const handleCroppedImage = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });
    setProfileImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImagePreview(reader.result as string);
    };
    reader.readAsDataURL(croppedBlob);
    setShowImageCropper(false);
    setImageToCrop('');
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
      setError('Image size should be less than 5MB');
      return;
    }

    // Set file and preview
    if (type === 'profile') {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageSrc = reader.result as string;
        setImageToCrop(imageSrc);
        setShowImageCropper(true);
      };
      reader.readAsDataURL(file);
    } else if (type === 'qid') {
      setQidImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setQidImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (type === 'passport') {
      setPassportImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPassportImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (type === 'medicalLicense') {
      setMedicalLicenseImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMedicalLicenseImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Validate terms and conditions first
    if (!agreeToTerms) {
      setError('You must agree to the Company Terms and Conditions to proceed.');
      setSubmitting(false);
      return;
    }

    // Validate form
    const validationResult = isFormValid();
    console.log('Form validation result:', validationResult);
    console.log('Form data:', formData);
    
    if (!validationResult) {
      const missingFields: string[] = [];
      if (!formData.fullName) missingFields.push('Full Name');
      if (!formData.phone) missingFields.push('Phone');
      if (!formData.gender) missingFields.push('Gender');
      if (!formData.dateOfBirth) missingFields.push('Date of Birth');
      if (!formData.department) missingFields.push('Department');
      if (!formData.dutyHours) missingFields.push('Duty Hours');
      if (!formData.position) missingFields.push('Position');
      if (!formData.employeeType) missingFields.push('Employee Type');
      if (!formData.salary) missingFields.push('Salary');
      if (!formData.qidNumber) missingFields.push('QID Number');
      if (!formData.qidExpiryDate) missingFields.push('QID Expiry Date');
      if (!formData.passportValidityDate) missingFields.push('Passport Validity Date');
      if (!formData.accommodation) missingFields.push('Accommodation');
      if (!formData.familyStatus) missingFields.push('Family Status');
      if (!formData.sponsorship) missingFields.push('Sponsorship');
      
      setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
      setSubmitting(false);
      return;
    }

    if (!user) {
      setError('User not authenticated. Please log in again.');
      setSubmitting(false);
      return;
    }

    try {
      console.log('Starting profile save...', { userId: user.uid, email: user.email });
      
      // Upload images first
      setUploadingImages(true);
      let profileImageUrl = '';
      let qidImageUrl = '';
      let passportImageUrl = '';
      let medicalLicenseImageUrl = '';

      try {
        if (profileImage) {
          profileImageUrl = await uploadImage(profileImage, `profiles/${user.uid}/profile.jpg`);
        }
        if (qidImage) {
          qidImageUrl = await uploadImage(qidImage, `documents/${user.uid}/qid.jpg`);
        }
        if (passportImage) {
          passportImageUrl = await uploadImage(passportImage, `documents/${user.uid}/passport.jpg`);
        }
        if (medicalLicenseImage) {
          medicalLicenseImageUrl = await uploadImage(medicalLicenseImage, `documents/${user.uid}/medical-license.jpg`);
        }
      } catch (uploadError: any) {
        console.error('Error uploading images:', uploadError);
        setError('Failed to upload images. Please try again.');
        setSubmitting(false);
        setUploadingImages(false);
        return;
      }
      
      setUploadingImages(false);
      
      // Prepare employee data - ensure all fields are properly formatted
      const employeeData: any = {
        employeeId: formData.employeeId,
        email: formData.email || user.email || '',
        role: 'employee',
        joinDate: formData.joinDate,
        fullName: formData.fullName,
        phone: formData.phone,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        age: formData.age,
        emergencyContactName: formData.emergencyContactName || '',
        emergencyContactPhone: formData.emergencyContactPhone || '',
        department: formData.department,
        dutyHours: formData.dutyHours,
        position: formData.position,
        employeeType: formData.employeeType,
        salary: formData.salary || '',
        yearsOfExperience: formData.yearsOfExperience || '',
        qidNumber: formData.qidNumber,
        qidExpiryDate: formData.qidExpiryDate || '',
        passportNumber: formData.passportNumber || '',
        passportValidityDate: formData.passportValidityDate || '',
        drivingLicenseValidityDate: formData.drivingLicenseValidityDate || '',
        accommodation: formData.accommodation,
        familyStatus: formData.familyStatus,
        sponsorship: formData.sponsorship,
        profileImageUrl: profileImageUrl || '',
        qidImageUrl: qidImageUrl || '',
        passportImageUrl: passportImageUrl || '',
        medicalLicenseImageUrl: medicalLicenseImageUrl || '',
        profileCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add medical fields if provided (optional for all users)
      if (formData.medicalDesignation || formData.medicalLicenseNumber || formData.workplaceName || formData.licenseValidityDate || medicalLicenseImageUrl) {
        employeeData.medicalDesignation = formData.medicalDesignation || '';
        employeeData.medicalLicenseNumber = formData.medicalLicenseNumber || '';
        employeeData.workplaceName = formData.workplaceName || '';
        employeeData.licenseValidityDate = formData.licenseValidityDate || '';
        employeeData.medicalLicenseImageUrl = medicalLicenseImageUrl || '';
      }

      console.log('Saving to employees collection...', employeeData);
      console.log('User UID:', user.uid);
      console.log('Firebase DB:', db);

      // Verify Firebase connection
      if (!db) {
        throw new Error('Firebase database connection not available');
      }

      // Save profile data to employees collection
      const employeeDocRef = doc(db, 'employees', user.uid);
      console.log('Document reference created:', employeeDocRef.path);
      
      await setDoc(employeeDocRef, employeeData);
      console.log('Profile saved successfully to employees collection');

      // Verify the save by reading it back
      const verifyDoc = await getDoc(employeeDocRef);
      if (!verifyDoc.exists()) {
        throw new Error('Profile save verification failed - document not found');
      }
      console.log('Profile save verified:', verifyDoc.data());

      // Also ensure userRoles collection is updated
      const userRoleDocRef = doc(db, 'userRoles', user.uid);
      await setDoc(userRoleDocRef, {
        role: 'employee',
        email: user.email,
        createdAt: new Date(),
      }, { merge: true });

      console.log('UserRoles updated successfully');

      // Also save to staffs collection so it appears in Staff Management
      const staffData = {
        name: formData.fullName,
        email: formData.email || user.email || '',
        phone: formData.phone,
        department: formData.department,
        employeeId: formData.employeeId,
        joinDate: formData.joinDate,
        status: 'active',
        authUserId: user.uid,
        hasUserAccount: true,
        role: formData.role || 'employee',
        position: formData.position || '',
        address: formData.emergencyContactName ? `${formData.emergencyContactName}, ${formData.emergencyContactPhone}` : '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to staffs collection - use user.uid as document ID to match employees collection
      const staffDocRef = doc(db, 'staffs', user.uid);
      await setDoc(staffDocRef, staffData, { merge: true });
      console.log('Staff data saved to staffs collection successfully');

      // Show success message
      setSuccess(true);
      setSubmitting(false);

      // Extract user's name from form data for welcome message
      const userName = formData.fullName || user.email?.split('@')[0] || 'User';
      setUserName(userName);

      // Wait a moment to show success message and ensure data is written
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Show welcome message after profile completion
      setShowWelcomeMessage(true);

      // Auto-hide welcome message and redirect after 5 seconds
      setTimeout(() => {
        setShowWelcomeMessage(false);
        // Force a page reload to ensure ProtectedRoute re-checks the profile status
        // This ensures the dashboard and main interfaces load correctly
        console.log('Redirecting to dashboard...');
        window.location.href = '/';
      }, 5000);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      setError(error.message || 'Failed to save profile. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-completion-container">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="profile-completion-container">
      {showWelcomeMessage && (
        <div className="welcome-message-overlay" onClick={() => setShowWelcomeMessage(false)}>
          <div className="welcome-message-card" onClick={(e) => e.stopPropagation()}>
            <button 
              className="welcome-close-btn"
              onClick={() => setShowWelcomeMessage(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="welcome-content">
              <div className="welcome-icon">
                <span>🎉</span>
              </div>
              <h2>Welcome To The Focus Staff Management System</h2>
              <p className="welcome-name">Hello, {userName}!</p>
              <p className="welcome-text">
                Congratulations! Your profile has been completed successfully. You will be redirected to the dashboard shortly.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="profile-completion-card">
        <div className="profile-header">
          <h1>Complete Your Profile</h1>
          <p>Please fill in your information to complete your profile setup</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Profile saved successfully! Redirecting to dashboard...</div>}

        <form onSubmit={handleSubmit} className="profile-form">
          {/* Employee ID & Email Section */}
          <section className="form-section">
            <h2 className="section-title">Account Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Employee ID *</label>
                <input
                  type="text"
                  value={formData.employeeId}
                  readOnly
                  className="read-only"
                />
                <small>Auto-generated and cannot be changed</small>
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  className="read-only"
                />
                <small>Email from your account</small>
              </div>
              <div className="form-group">
                <label>Joining Date *</label>
                <input
                  type="date"
                  name="joinDate"
                  value={formData.joinDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </section>

          {/* Profile Image */}
          <section className="form-section">
            <h2 className="section-title">Profile Image</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Profile Picture</label>
                <div className="image-upload-container">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'profile')}
                    className="image-input"
                    id="profile-image"
                  />
                  <label htmlFor="profile-image" className="image-upload-label">
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt="Profile preview" className="image-preview" />
                    ) : (
                      <div className="image-upload-placeholder">
                        <span>+</span>
                        <p>Upload Profile Image</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Personal Information */}
          <section className="form-section">
            <h2 className="section-title">Personal Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  onKeyPress={(e) => {
                    // Prevent number input
                    if (/\d/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  pattern="[A-Za-z\s'-]+"
                  title="Full name should contain only letters, spaces, hyphens, and apostrophes"
                  required
                  placeholder="Enter your full name"
                />
                <small>Letters, spaces, hyphens, and apostrophes only</small>
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="+974 XXXX XXXX"
                />
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Date of Birth *</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  value={formData.age}
                  readOnly
                  className="read-only"
                />
                <small>Auto-calculated from date of birth</small>
              </div>
              <div className="form-group">
                <label>Emergency Contact Name</label>
                <input
                  type="text"
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleChange}
                  onKeyPress={(e) => {
                    // Prevent number input
                    if (/\d/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  pattern="[A-Za-z\s'-]+"
                  title="Emergency contact name should contain only letters, spaces, hyphens, and apostrophes"
                  placeholder="Emergency contact person name"
                />
                <small>Letters, spaces, hyphens, and apostrophes only</small>
              </div>
              <div className="form-group">
                <label>Emergency Contact Phone</label>
                <input
                  type="tel"
                  name="emergencyContactPhone"
                  value={formData.emergencyContactPhone}
                  onChange={handleChange}
                  placeholder="+974 XXXX XXXX"
                />
              </div>
            </div>
          </section>

          {/* Work Information */}
          <section className="form-section">
            <h2 className="section-title">Work Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Department *</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Duty Hours *</label>
                <input
                  type="text"
                  name="dutyHours"
                  value={formData.dutyHours}
                  onChange={handleChange}
                  required
                  placeholder="e.g., 8:00 AM - 5:00 PM"
                />
              </div>
              <div className="form-group">
                <label>Position / Designation *</label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  required
                  placeholder="Your job title"
                />
              </div>
              <div className="form-group">
                <label>Employee Type *</label>
                <select
                  name="employeeType"
                  value={formData.employeeType}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Type</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
              <div className="form-group">
                <label>Salary *</label>
                <input
                  type="number"
                  name="salary"
                  value={formData.salary}
                  onChange={handleChange}
                  placeholder="Monthly salary"
                  min="0"
                  required
                />
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="number"
                  name="yearsOfExperience"
                  value={formData.yearsOfExperience}
                  onChange={handleChange}
                  placeholder="Years"
                  min="0"
                />
              </div>
            </div>
          </section>

          {/* Document Information */}
          <section className="form-section">
            <h2 className="section-title">Document Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>QID Number *</label>
                <input
                  type="text"
                  name="qidNumber"
                  value={formData.qidNumber}
                  onChange={handleChange}
                  required
                  placeholder="Qatar ID Number"
                  pattern="[0-9]{11}"
                  title="QID must be 11 digits"
                />
                <small>11-digit Qatar ID Number</small>
              </div>
              <div className="form-group">
                <label>QID Expiry Date *</label>
                <input
                  type="date"
                  name="qidExpiryDate"
                  value={formData.qidExpiryDate}
                  onChange={handleChange}
                  required
                />
                <small>Qatar ID Expiry Date</small>
              </div>
              <div className="form-group">
                <label>QID Image *</label>
                <div className="image-upload-container">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'qid')}
                    className="image-input"
                    id="qid-image"
                    required
                  />
                  <label htmlFor="qid-image" className="image-upload-label">
                    {qidImagePreview ? (
                      <img src={qidImagePreview} alt="QID preview" className="image-preview" />
                    ) : (
                      <div className="image-upload-placeholder">
                        <span>+</span>
                        <p>Upload QID Image</p>
                      </div>
                    )}
                  </label>
                </div>
                <small>Mandatory - Upload clear image of your QID</small>
              </div>
              <div className="form-group">
                <label>Passport Number</label>
                <input
                  type="text"
                  name="passportNumber"
                  value={formData.passportNumber || ''}
                  onChange={handleChange}
                  placeholder="Passport Number"
                />
                <small>Passport Number (Optional)</small>
              </div>
              <div className="form-group">
                <label>Passport Validity Date *</label>
                <input
                  type="date"
                  name="passportValidityDate"
                  value={formData.passportValidityDate}
                  onChange={handleChange}
                  required
                />
                <small>Passport Expiry Date</small>
              </div>
              <div className="form-group">
                <label>Passport Image *</label>
                <div className="image-upload-container">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'passport')}
                    className="image-input"
                    id="passport-image"
                    required
                  />
                  <label htmlFor="passport-image" className="image-upload-label">
                    {passportImagePreview ? (
                      <img src={passportImagePreview} alt="Passport preview" className="image-preview" />
                    ) : (
                      <div className="image-upload-placeholder">
                        <span>+</span>
                        <p>Upload Passport Image</p>
                      </div>
                    )}
                  </label>
                </div>
                <small>Mandatory - Upload clear image of your Passport</small>
              </div>
              <div className="form-group">
                <label>Driving License Validity Date</label>
                <input
                  type="date"
                  name="drivingLicenseValidityDate"
                  value={formData.drivingLicenseValidityDate}
                  onChange={handleChange}
                />
                <small>Driving License Expiry Date (Optional)</small>
              </div>
            </div>
          </section>

          {/* Medical Information (Optional for All Users) */}
          <section className="form-section">
            <h2 className="section-title">Medical Information (Optional)</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Medical Field / Designation</label>
                <input
                  type="text"
                  name="medicalDesignation"
                  value={formData.medicalDesignation || ''}
                  onChange={handleChange}
                  placeholder="e.g., General Practitioner, Registered Nurse, Pharmacist"
                />
                <small>Your medical field or designation (Optional)</small>
              </div>
              <div className="form-group">
                <label>Medical License Number</label>
                <input
                  type="text"
                  name="medicalLicenseNumber"
                  value={formData.medicalLicenseNumber || ''}
                  onChange={handleChange}
                  placeholder="Medical license number"
                />
                <small>License Number (Optional)</small>
              </div>
              <div className="form-group">
                <label>License Expiry Date</label>
                <input
                  type="date"
                  name="licenseValidityDate"
                  value={formData.licenseValidityDate || ''}
                  onChange={handleChange}
                />
                <small>License Expiry Date (Optional)</small>
              </div>
              <div className="form-group">
                <label>Workplace / Hospital / Clinic Name</label>
                <input
                  type="text"
                  name="workplaceName"
                  value={formData.workplaceName || ''}
                  onChange={handleChange}
                  placeholder="Name of workplace"
                />
                <small>Workplace Name (Optional)</small>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Medical License Image</label>
                <div className="image-upload-container">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'medicalLicense')}
                    className="image-input"
                    id="medical-license-image"
                  />
                  <label htmlFor="medical-license-image" className="image-upload-label">
                    {medicalLicenseImagePreview ? (
                      <img src={medicalLicenseImagePreview} alt="Medical License preview" className="image-preview" />
                    ) : (
                      <div className="image-upload-placeholder">
                        <span>+</span>
                        <p>Upload Medical License Image</p>
                      </div>
                    )}
                  </label>
                </div>
                <small>Upload Medical License Image (Optional)</small>
              </div>
            </div>
          </section>

          {/* Qatar-Specific Information */}
          <section className="form-section">
            <h2 className="section-title">Qatar-Specific Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Accommodation *</label>
                <select
                  name="accommodation"
                  value={formData.accommodation}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Family Status *</label>
                <select
                  name="familyStatus"
                  value={formData.familyStatus}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                </select>
              </div>
              <div className="form-group">
                <label>Sponsorship *</label>
                <select
                  name="sponsorship"
                  value={formData.sponsorship}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select</option>
                  <option value="Company">Company</option>
                  <option value="Personal">Personal</option>
                  <option value="Family">Family</option>
                </select>
              </div>
            </div>
          </section>

          {/* Terms and Conditions */}
          <div className="terms-section">
            <label className="terms-checkbox-label">
              <input
                type="checkbox"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                required
                className="terms-checkbox"
              />
              <span className="terms-text">
                I agree to the <strong>Company Terms and Conditions</strong> *
              </span>
            </label>
            {!agreeToTerms && (
              <p className="terms-error">You must agree to the Company Terms and Conditions to proceed.</p>
            )}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={!isFormValid() || submitting || uploadingImages}
            >
              {uploadingImages ? 'Uploading Images...' : submitting ? 'Saving Profile...' : 'Complete Profile'}
            </button>
          </div>
        </form>
      </div>
      
      {showImageCropper && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCrop={handleCroppedImage}
          onCancel={() => {
            setShowImageCropper(false);
            setImageToCrop('');
          }}
          aspectRatio={1}
          circular={true}
        />
      )}
    </div>
  );
};

export default ProfileCompletion;

