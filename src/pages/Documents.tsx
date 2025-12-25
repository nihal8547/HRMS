import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, doc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { fetchUserRole, isAdmin } from '../utils/userRole';
import Icon from '../components/Icons';
import jsPDF from 'jspdf';
import './Documents.css';

interface EmployeeDocument {
  id: string;
  employeeId: string;
  fullName: string;
  name?: string;
  qidImageUrl?: string;
  passportImageUrl?: string;
  medicalLicenseImageUrl?: string;
  qidNumber?: string;
  qidExpiryDate?: string;
  passportValidityDate?: string;
  licenseValidityDate?: string;
  medicalLicenseNumber?: string;
  dateOfBirth?: string;
}

interface CompanyDocument {
  id: string;
  name: string;
  description?: string;
  documentUrl: string;
  expiryDate?: string;
  uploadDate: string;
  uploadedBy: string;
  uploadedByName?: string;
  warningDays?: number;
}

interface UserDocument {
  id: string;
  employeeId: string;
  userId: string;
  documentName: string;
  documentUrl: string;
  documentType?: string;
  uploadDate: string;
  description?: string;
}

type SortOption = 'name-asc' | 'name-desc' | 'id-asc' | 'id-desc';

const Documents = () => {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<EmployeeDocument[]>([]);
  const [error, setError] = useState('');
  const [_currentUserId, setCurrentUserId] = useState<string>('');
  const [_userRole, setUserRole] = useState<string>('');
  const [_isAdminUser, setIsAdminUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [currentUserData, setCurrentUserData] = useState<EmployeeDocument | null>(null);
  const [stats, setStats] = useState({
    expiredDocuments: 0,
    expiringSoon: 0,
    totalDocuments: 0,
    daysUntilBirthday: 0
  });
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [companyDocuments, setCompanyDocuments] = useState<CompanyDocument[]>([]);
  const [showCompanyUpload, setShowCompanyUpload] = useState(false);
  const [uploadingCompanyDoc, setUploadingCompanyDoc] = useState(false);
  const [newCompanyDoc, setNewCompanyDoc] = useState({
    name: '',
    description: '',
    expiryDate: '',
    warningDays: 30,
    file: null as File | null
  });
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);
  const [showUserUpload, setShowUserUpload] = useState(false);
  const [uploadingUserDoc, setUploadingUserDoc] = useState(false);
  const [newUserDoc, setNewUserDoc] = useState({
    documentName: '',
    description: '',
    documentType: '',
    file: null as File | null
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await fetchDocuments(user.uid, role);
        await fetchCompanyDocuments(user.uid, role);
        await fetchUserDocuments(user.uid, role);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterAndSortDocuments();
  }, [documents, searchTerm, sortOption]);

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const calculateDaysUntilBirthday = (dateOfBirth: string | undefined): number => {
    if (!dateOfBirth) return 0;
    try {
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
      const currentYear = today.getFullYear();
      
      // Set birthday to this year
      const thisYearBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
      
      // If birthday has passed this year, set to next year
      const nextBirthday = thisYearBirthday < today 
        ? new Date(currentYear + 1, birthDate.getMonth(), birthDate.getDate())
        : thisYearBirthday;
      
      const diffTime = nextBirthday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays >= 0 ? diffDays : 0;
    } catch {
      return 0;
    }
  };

  const calculateStats = (docs: EmployeeDocument[], uid: string) => {
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let userDoc: EmployeeDocument | null = null;

    docs.forEach(doc => {
      // Check QID expiry
      if (isExpired(doc.qidExpiryDate)) expiredCount++;
      else if (isExpiringSoon(doc.qidExpiryDate)) expiringSoonCount++;
      
      // Check Passport expiry
      if (isExpired(doc.passportValidityDate)) expiredCount++;
      else if (isExpiringSoon(doc.passportValidityDate)) expiringSoonCount++;
      
      // Check Medical License expiry
      if (doc.licenseValidityDate) {
        if (isExpired(doc.licenseValidityDate)) expiredCount++;
        else if (isExpiringSoon(doc.licenseValidityDate)) expiringSoonCount++;
      }

      // Find current user's document
      if (doc.id === uid) {
        userDoc = doc;
      }
    });

    let daysUntilBirthday = 0;
    if (userDoc) {
      const dateOfBirth = (userDoc as EmployeeDocument).dateOfBirth;
      if (dateOfBirth) {
        daysUntilBirthday = calculateDaysUntilBirthday(dateOfBirth);
      }
    }

    setStats({
      expiredDocuments: expiredCount,
      expiringSoon: expiringSoonCount,
      totalDocuments: docs.length,
      daysUntilBirthday
    });

    setCurrentUserData(userDoc);
  };

  const isExpiringSoon = (dateString: string | undefined, days: number = 90): boolean => {
    if (!dateString) return false;
    try {
      const expiryDate = new Date(dateString);
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= days;
    } catch {
      return false;
    }
  };

  const isExpired = (dateString: string | undefined): boolean => {
    if (!dateString) return false;
    try {
      const expiryDate = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);
      return expiryDate < today;
    } catch {
      return false;
    }
  };

  const filterAndSortDocuments = () => {
    let filtered = [...documents];

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(doc =>
        doc.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.fullName.localeCompare(b.fullName);
        case 'name-desc':
          return b.fullName.localeCompare(a.fullName);
        case 'id-asc':
          return a.employeeId.localeCompare(b.employeeId);
        case 'id-desc':
          return b.employeeId.localeCompare(a.employeeId);
        default:
          return 0;
      }
    });

    setFilteredDocuments(filtered);
  };

  const handleImageClick = (imageUrl: string, title: string) => {
    setSelectedImage({ url: imageUrl, title });
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const downloadEmployeeDocuments = async (employee: EmployeeDocument) => {
    try {
      setDownloading(employee.id);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPos = 20;

      // Add header
      pdf.setFontSize(18);
      pdf.setTextColor(0, 102, 153);
      pdf.text('Employee Documents', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Employee Name: ${employee.fullName}`, 20, yPos);
      yPos += 7;
      pdf.text(`Employee ID: ${employee.employeeId}`, 20, yPos);
      yPos += 15;

      // Helper function to add image to PDF
      const addImageToPDF = async (imageUrl: string, label: string, expiryDate?: string) => {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const imageData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          // Check if we need a new page
          if (yPos > pageHeight - 80) {
            pdf.addPage();
            yPos = 20;
          }

          // Add label
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.text(label || 'Document', 20, yPos);
          yPos += 5;

          // Add expiry date if provided
          if (expiryDate) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            const expiryText = `Expiry Date: ${formatDate(expiryDate)}`;
            pdf.text(expiryText, 20, yPos);
            yPos += 3;
          }

          // Calculate image dimensions (max width 170mm, maintain aspect ratio)
          const maxWidth = 170;
          const maxHeight = 100;
          
          // Create an image element to get dimensions
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = resolve;
            img.src = imageData;
          });

          let imgWidth = img.width * 0.264583; // Convert pixels to mm
          let imgHeight = img.height * 0.264583;

          // Scale to fit within max dimensions
          const widthRatio = maxWidth / imgWidth;
          const heightRatio = maxHeight / imgHeight;
          const ratio = Math.min(widthRatio, heightRatio, 1);

          imgWidth *= ratio;
          imgHeight *= ratio;

          // Check if image fits on current page
          if (yPos + imgHeight > pageHeight - 20) {
            pdf.addPage();
            yPos = 20;
          }

          pdf.addImage(imageData, 'JPEG', 20, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10;
        } catch (error) {
          console.error(`Error adding ${label} image:`, error);
          pdf.setFontSize(9);
          pdf.setTextColor(150, 0, 0);
          pdf.text(`${label} image could not be loaded`, 20, yPos);
          yPos += 5;
        }
      };

      // Add QID document
      if (employee.qidImageUrl) {
        await addImageToPDF(
          employee.qidImageUrl,
          `QID${employee.qidNumber ? ` - ${employee.qidNumber}` : ''}`,
          employee.qidExpiryDate
        );
      }

      // Add Passport document
      if (employee.passportImageUrl) {
        await addImageToPDF(
          employee.passportImageUrl,
          'Passport',
          employee.passportValidityDate
        );
      }

      // Add Medical License document
      if (employee.medicalLicenseImageUrl) {
        await addImageToPDF(
          employee.medicalLicenseImageUrl,
          `Medical License${employee.medicalLicenseNumber ? ` - ${employee.medicalLicenseNumber}` : ''}`,
          employee.licenseValidityDate
        );
      }

      // Save PDF
      const fileName = `${employee.fullName}_${employee.employeeId}_Documents.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error downloading documents:', error);
      alert('Failed to download documents. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const fetchDocuments = async (uid: string, role: string) => {
    try {
      setLoading(true);
      setError('');

      const docsList: EmployeeDocument[] = [];
      const adminUser = isAdmin(role);

      if (adminUser) {
        // Admin can see all documents
        // Fetch from employees collection
        const employeesQuery = query(collection(db, 'employees'), orderBy('fullName', 'asc'));
        const employeesSnapshot = await getDocs(employeesQuery);
        
        employeesSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.qidImageUrl || data.passportImageUrl || data.medicalLicenseImageUrl) {
            docsList.push({
              id: doc.id,
              employeeId: data.employeeId || '',
              fullName: data.fullName || data.name || 'N/A',
              qidImageUrl: data.qidImageUrl || '',
              passportImageUrl: data.passportImageUrl || '',
              medicalLicenseImageUrl: data.medicalLicenseImageUrl || '',
              qidNumber: data.qidNumber || '',
              qidExpiryDate: data.qidExpiryDate || '',
              passportValidityDate: data.passportValidityDate || '',
              licenseValidityDate: data.licenseValidityDate || '',
              medicalLicenseNumber: data.medicalLicenseNumber || ''
            });
          }
        });

        // Also fetch from staffs collection
        const staffsQuery = query(collection(db, 'staffs'), orderBy('name', 'asc'));
        const staffsSnapshot = await getDocs(staffsQuery);
        
        staffsSnapshot.forEach((doc) => {
          const data = doc.data();
          // Check if not already added from employees
          const exists = docsList.find(d => d.employeeId === data.employeeId);
          if (!exists && (data.qidImageUrl || data.passportImageUrl || data.medicalLicenseImageUrl)) {
            docsList.push({
              id: doc.id,
              employeeId: data.employeeId || '',
              fullName: data.name || data.fullName || 'N/A',
              qidImageUrl: data.qidImageUrl || '',
              passportImageUrl: data.passportImageUrl || '',
              medicalLicenseImageUrl: data.medicalLicenseImageUrl || '',
              qidNumber: data.qidNumber || '',
              qidExpiryDate: data.qidExpiryDate || '',
              passportValidityDate: data.passportValidityDate || '',
              licenseValidityDate: data.licenseValidityDate || '',
              medicalLicenseNumber: data.medicalLicenseNumber || ''
            });
          }
        });
      } else {
        // Non-admin users can only see their own documents
        // Try to fetch from employees collection first
        const employeeDoc = await getDoc(doc(db, 'employees', uid));
        if (employeeDoc.exists()) {
          const data = employeeDoc.data();
          if (data.qidImageUrl || data.passportImageUrl || data.medicalLicenseImageUrl) {
            docsList.push({
              id: employeeDoc.id,
              employeeId: data.employeeId || '',
              fullName: data.fullName || data.name || 'N/A',
              qidImageUrl: data.qidImageUrl || '',
              passportImageUrl: data.passportImageUrl || '',
              medicalLicenseImageUrl: data.medicalLicenseImageUrl || '',
              qidNumber: data.qidNumber || '',
              qidExpiryDate: data.qidExpiryDate || '',
              passportValidityDate: data.passportValidityDate || '',
              licenseValidityDate: data.licenseValidityDate || '',
              medicalLicenseNumber: data.medicalLicenseNumber || '',
              dateOfBirth: data.dateOfBirth || ''
            });
          }
        } else {
          // Try staffs collection by authUserId
          const staffQuery = query(collection(db, 'staffs'), where('authUserId', '==', uid));
          const staffSnapshot = await getDocs(staffQuery);
          if (!staffSnapshot.empty) {
            const data = staffSnapshot.docs[0].data();
            if (data.qidImageUrl || data.passportImageUrl || data.medicalLicenseImageUrl) {
              docsList.push({
                id: staffSnapshot.docs[0].id,
                employeeId: data.employeeId || '',
                fullName: data.name || data.fullName || 'N/A',
                qidImageUrl: data.qidImageUrl || '',
                passportImageUrl: data.passportImageUrl || '',
                medicalLicenseImageUrl: data.medicalLicenseImageUrl || '',
                qidNumber: data.qidNumber || '',
                qidExpiryDate: data.qidExpiryDate || '',
                passportValidityDate: data.passportValidityDate || '',
                licenseValidityDate: data.licenseValidityDate || '',
                medicalLicenseNumber: data.medicalLicenseNumber || '',
                dateOfBirth: data.dateOfBirth || ''
              });
            }
          }
        }
      }

      setDocuments(docsList);
      calculateStats(docsList, uid);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyDocuments = async (_uid: string, role: string) => {
    try {
      const adminUser = isAdmin(role);
      
      // Only admins can see company documents
      if (!adminUser) {
        setCompanyDocuments([]);
        return;
      }

      const companyDocsQuery = query(collection(db, 'companyDocuments'), orderBy('uploadDate', 'desc'));
      const snapshot = await getDocs(companyDocsQuery);
      
      const docs: CompanyDocument[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        docs.push({
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          documentUrl: data.documentUrl || '',
          expiryDate: data.expiryDate || '',
          uploadDate: data.uploadDate || '',
          uploadedBy: data.uploadedBy || '',
          uploadedByName: data.uploadedByName || '',
          warningDays: data.warningDays || 30
        });
      });

      setCompanyDocuments(docs);
    } catch (err) {
      console.error('Error fetching company documents:', err);
    }
  };

  const uploadCompanyDocument = async () => {
    if (!newCompanyDoc.name || !newCompanyDoc.file) {
      alert('Please provide document name and select a file');
      return;
    }

    try {
      setUploadingCompanyDoc(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('You must be logged in to upload documents');
        return;
      }

      // Get user name
      const userDoc = await getDoc(doc(db, 'employees', currentUser.uid));
      const userName = userDoc.exists() 
        ? (userDoc.data().fullName || userDoc.data().name || 'Unknown')
        : 'Unknown';

      // Upload file to Firebase Storage
      const fileName = `company-documents/${Date.now()}_${newCompanyDoc.file.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, newCompanyDoc.file);
      const downloadURL = await getDownloadURL(storageRef);

      // Save document info to Firestore
      await addDoc(collection(db, 'companyDocuments'), {
        name: newCompanyDoc.name,
        description: newCompanyDoc.description || '',
        documentUrl: downloadURL,
        expiryDate: newCompanyDoc.expiryDate || '',
        uploadDate: new Date().toISOString(),
        uploadedBy: currentUser.uid,
        uploadedByName: userName,
        warningDays: newCompanyDoc.warningDays || 30
      });

      // Reset form and refresh list
      setNewCompanyDoc({
        name: '',
        description: '',
        expiryDate: '',
        warningDays: 30,
        file: null
      });
      setShowCompanyUpload(false);
      await fetchCompanyDocuments(currentUser.uid, await fetchUserRole(currentUser.uid));
      alert('Company document uploaded successfully');
    } catch (error) {
      console.error('Error uploading company document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploadingCompanyDoc(false);
    }
  };

  const deleteCompanyDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this company document?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'companyDocuments', docId));
      const currentUser = auth.currentUser;
      if (currentUser) {
        await fetchCompanyDocuments(currentUser.uid, await fetchUserRole(currentUser.uid));
      }
      alert('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting company document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  // Helper functions for company documents (to avoid name conflicts)
  const checkIsExpired = (dateString: string | undefined): boolean => {
    if (!dateString) return false;
    try {
      const expiryDate = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);
      return expiryDate < today;
    } catch {
      return false;
    }
  };

  const checkIsExpiringSoon = (dateString: string | undefined, days: number = 30): boolean => {
    if (!dateString) return false;
    try {
      const expiryDate = new Date(dateString);
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= days;
    } catch {
      return false;
    }
  };

  const fetchUserDocuments = async (uid: string, role: string) => {
    try {
      const adminUser = isAdmin(role);
      let queryRef;
      
      if (adminUser) {
        // Admin can see all user documents
        queryRef = query(collection(db, 'userDocuments'), orderBy('uploadDate', 'desc'));
      } else {
        // Non-admin users can only see their own documents
        queryRef = query(collection(db, 'userDocuments'), where('userId', '==', uid), orderBy('uploadDate', 'desc'));
      }
      
      const snapshot = await getDocs(queryRef);
      const docs: UserDocument[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        docs.push({
          id: docSnap.id,
          employeeId: data.employeeId || '',
          userId: data.userId || '',
          documentName: data.documentName || '',
          documentUrl: data.documentUrl || '',
          documentType: data.documentType || '',
          uploadDate: data.uploadDate || '',
          description: data.description || ''
        });
      });
      
      setUserDocuments(docs);
    } catch (error) {
      console.error('Error fetching user documents:', error);
    }
  };

  const uploadUserDocument = async () => {
    if (!newUserDoc.documentName || !newUserDoc.file) {
      alert('Please provide document name and select a file');
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('You must be logged in to upload documents');
        return;
      }

      setUploadingUserDoc(true);

      // Get employee ID from current user data
      const employeeId = currentUserData?.employeeId || '';
      if (!employeeId) {
        alert('Employee ID not found. Please complete your profile first.');
        setUploadingUserDoc(false);
        return;
      }

      // Validate file size (max 10MB)
      if (newUserDoc.file.size > 10 * 1024 * 1024) {
        alert('File size should be less than 10MB');
        setUploadingUserDoc(false);
        return;
      }

      // Upload file to Firebase Storage
      const fileExtension = newUserDoc.file.name.split('.').pop();
      const fileName = `user-doc-${currentUser.uid}-${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `user-documents/${currentUser.uid}/${fileName}`);
      await uploadBytes(storageRef, newUserDoc.file);
      const downloadURL = await getDownloadURL(storageRef);

      // Save document metadata to Firestore
      await addDoc(collection(db, 'userDocuments'), {
        employeeId: employeeId,
        userId: currentUser.uid,
        documentName: newUserDoc.documentName,
        documentUrl: downloadURL,
        documentType: newUserDoc.documentType || 'Other',
        description: newUserDoc.description || '',
        uploadDate: new Date().toISOString()
      });

      // Reset form
      setNewUserDoc({
        documentName: '',
        description: '',
        documentType: '',
        file: null
      });
      setShowUserUpload(false);
      
      // Refresh user documents
      await fetchUserDocuments(currentUser.uid, _userRole);
      alert('Document uploaded successfully');
    } catch (error) {
      console.error('Error uploading user document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploadingUserDoc(false);
    }
  };

  const deleteUserDocument = async (docId: string, _documentUrl: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }
    
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'userDocuments', docId));
      
      // Note: Firebase Storage file deletion would require admin SDK
      // For now, we'll just delete the Firestore record
      // The file will remain in storage but won't be accessible
      
      await fetchUserDocuments(_currentUserId, _userRole);
      alert('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting user document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="full-page">
        <div className="documents-page">
          <div className="loading-state">
            <p>Loading documents...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="full-page">
        <div className="documents-page">
          <div className="error-state">
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-page">
      <div className="documents-page">
        <div className="documents-header">
          <h1>
            <Icon name="file-text" />
            Employee Documents
          </h1>
        </div>

        {/* Status Cards */}
        <div className="status-cards-grid">
          <div className="status-card expired-card">
            <div className="status-card-icon">
              <Icon name="alert-circle" />
            </div>
            <div className="status-card-content">
              <h3>Expired Documents</h3>
              <p className="status-card-value">{stats.expiredDocuments}</p>
              <span className="status-card-label">Documents expired</span>
            </div>
          </div>

          <div className="status-card expiring-card">
            <div className="status-card-icon">
              <Icon name="clock" />
            </div>
            <div className="status-card-content">
              <h3>Expiring Soon</h3>
              <p className="status-card-value">{stats.expiringSoon}</p>
              <span className="status-card-label">Within 90 days</span>
            </div>
          </div>

          <div className="status-card user-info-card">
            <div className="status-card-icon">
              <Icon name="user" />
            </div>
            <div className="status-card-content">
              <h3>{currentUserData?.fullName || 'N/A'}</h3>
              <p className="status-card-value">{formatDate(currentUserData?.dateOfBirth)}</p>
              <span className="status-card-label">Date of Birth</span>
            </div>
          </div>

          <div className="status-card birthday-card">
            <div className="status-card-icon">
              <Icon name="calendar" />
            </div>
            <div className="status-card-content">
              <h3>Birthday</h3>
              <p className="status-card-value">{stats.daysUntilBirthday}</p>
              <span className="status-card-label">Days remaining</span>
            </div>
          </div>
        </div>

        <div className="documents-controls">
          <div className="search-wrapper">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="sort-wrapper">
            <label htmlFor="sort-select">Sort by:</label>
            <select
              id="sort-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="sort-select"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="id-asc">Employee ID (Ascending)</option>
              <option value="id-desc">Employee ID (Descending)</option>
            </select>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="empty-state">
            <p>No documents found</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state">
            <p>No documents match your search criteria</p>
          </div>
        ) : (
          <>
            <div className="documents-count">
              Showing {filteredDocuments.length} of {documents.length} documents
            </div>
            <div className="documents-grid">
              {filteredDocuments.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-header">
                  <div className="employee-info">
                    <h3>{doc.fullName}</h3>
                    <p className="employee-id">Emp ID: {doc.employeeId}</p>
                  </div>
                  <button
                    className="download-btn"
                    onClick={() => downloadEmployeeDocuments(doc)}
                    disabled={downloading === doc.id}
                    title="Download all documents"
                  >
                    {downloading === doc.id ? (
                      <>
                        <span className="download-spinner"></span>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Icon name="download" />
                        Download
                      </>
                    )}
                  </button>
                </div>
                <div className="document-images">
                  <div className="document-image-item">
                    <div className="document-label-row">
                      <label>QID</label>
                      {doc.qidNumber && (
                        <span className="document-number">ID: {doc.qidNumber}</span>
                      )}
                    </div>
                    {doc.qidImageUrl ? (
                      <div className="image-container">
                        <img 
                          src={doc.qidImageUrl} 
                          alt="QID" 
                          className="document-image" 
                          onClick={() => doc.qidImageUrl && handleImageClick(doc.qidImageUrl, `QID - ${doc.fullName}`)}
                        />
                      </div>
                    ) : (
                      <div className="no-image">No QID Image</div>
                    )}
                    <div className="document-expiry">
                      <span className="expiry-label">Expiry Date:</span>
                      <span className={`expiry-value ${
                        isExpired(doc.qidExpiryDate) ? 'expired' :
                        isExpiringSoon(doc.qidExpiryDate) ? 'expiring-soon' : ''
                      }`}>
                        {formatDate(doc.qidExpiryDate)}
                      </span>
                      {isExpired(doc.qidExpiryDate) && (
                        <span className="expiry-badge expired-badge">Expired</span>
                      )}
                      {!isExpired(doc.qidExpiryDate) && isExpiringSoon(doc.qidExpiryDate) && (
                        <span className="expiry-badge expiring-badge">Expiring Soon</span>
                      )}
                    </div>
                  </div>
                  <div className="document-image-item">
                    <div className="document-label-row">
                      <label>Passport</label>
                    </div>
                    {doc.passportImageUrl ? (
                      <div className="image-container">
                        <img 
                          src={doc.passportImageUrl} 
                          alt="Passport" 
                          className="document-image" 
                          onClick={() => doc.passportImageUrl && handleImageClick(doc.passportImageUrl, `Passport - ${doc.fullName}`)}
                        />
                      </div>
                    ) : (
                      <div className="no-image">No Passport Image</div>
                    )}
                    <div className="document-expiry">
                      <span className="expiry-label">Expiry Date:</span>
                      <span className={`expiry-value ${
                        isExpired(doc.passportValidityDate) ? 'expired' :
                        isExpiringSoon(doc.passportValidityDate) ? 'expiring-soon' : ''
                      }`}>
                        {formatDate(doc.passportValidityDate)}
                      </span>
                      {isExpired(doc.passportValidityDate) && (
                        <span className="expiry-badge expired-badge">Expired</span>
                      )}
                      {!isExpired(doc.passportValidityDate) && isExpiringSoon(doc.passportValidityDate) && (
                        <span className="expiry-badge expiring-badge">Expiring Soon</span>
                      )}
                    </div>
                  </div>
                  {doc.medicalLicenseImageUrl && (
                    <div className="document-image-item">
                      <div className="document-label-row">
                        <label>Medical License</label>
                        {doc.medicalLicenseNumber && (
                          <span className="document-number">License: {doc.medicalLicenseNumber}</span>
                        )}
                      </div>
                      <div className="image-container">
                        <img 
                          src={doc.medicalLicenseImageUrl} 
                          alt="Medical License" 
                          className="document-image" 
                          onClick={() => doc.medicalLicenseImageUrl && handleImageClick(doc.medicalLicenseImageUrl, `Medical License - ${doc.fullName}`)}
                        />
                      </div>
                      <div className="document-expiry">
                        <span className="expiry-label">Expiry Date:</span>
                        <span className={`expiry-value ${
                          isExpired(doc.licenseValidityDate) ? 'expired' :
                          isExpiringSoon(doc.licenseValidityDate) ? 'expiring-soon' : ''
                        }`}>
                          {formatDate(doc.licenseValidityDate)}
                        </span>
                        {isExpired(doc.licenseValidityDate) && (
                          <span className="expiry-badge expired-badge">Expired</span>
                        )}
                        {!isExpired(doc.licenseValidityDate) && isExpiringSoon(doc.licenseValidityDate) && (
                          <span className="expiry-badge expiring-badge">Expiring Soon</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              ))}
            </div>
          </>
        )}

        {/* User Documents Section */}
        <div className="user-documents-section">
          <div className="section-header">
            <h2>My Documents</h2>
            <button
              className="btn-upload-user-doc"
              onClick={() => setShowUserUpload(!showUserUpload)}
              disabled={uploadingUserDoc}
            >
              <Icon name="upload" />
              {showUserUpload ? 'Cancel Upload' : 'Upload Document'}
            </button>
          </div>

          {/* Upload Form */}
          {showUserUpload && (
            <div className="user-upload-form">
              <h3>Upload New Document</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Document Name *</label>
                  <input
                    type="text"
                    value={newUserDoc.documentName}
                    onChange={(e) => setNewUserDoc(prev => ({ ...prev, documentName: e.target.value }))}
                    placeholder="e.g., Certificate, License, etc."
                    disabled={uploadingUserDoc}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Document Type</label>
                  <select
                    value={newUserDoc.documentType}
                    onChange={(e) => setNewUserDoc(prev => ({ ...prev, documentType: e.target.value }))}
                    disabled={uploadingUserDoc}
                  >
                    <option value="">Select Type</option>
                    <option value="Certificate">Certificate</option>
                    <option value="License">License</option>
                    <option value="Contract">Contract</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newUserDoc.description}
                  onChange={(e) => setNewUserDoc(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={3}
                  disabled={uploadingUserDoc}
                />
              </div>
              <div className="form-group">
                <label>Document File *</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setNewUserDoc(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  disabled={uploadingUserDoc}
                  required
                />
                <small>Accepted formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)</small>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setShowUserUpload(false);
                    setNewUserDoc({
                      documentName: '',
                      description: '',
                      documentType: '',
                      file: null
                    });
                  }}
                  disabled={uploadingUserDoc}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-upload"
                  onClick={uploadUserDocument}
                  disabled={uploadingUserDoc || !newUserDoc.documentName || !newUserDoc.file}
                >
                  {uploadingUserDoc ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </div>
          )}

          {/* User Documents List */}
          {userDocuments.length === 0 ? (
            <div className="no-documents">
              <Icon name="file-text" />
              <p>No documents uploaded yet</p>
            </div>
          ) : (
            <div className="user-documents-grid">
              {userDocuments.map((doc) => (
                <div key={doc.id} className="user-document-card">
                  <div className="document-card-header">
                    <div className="document-info">
                      <h4>{doc.documentName}</h4>
                      {doc.documentType && <span className="document-type">{doc.documentType}</span>}
                    </div>
                    <button
                      className="btn-delete-user-doc"
                      onClick={() => deleteUserDocument(doc.id, doc.documentUrl)}
                      title="Delete document"
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                  {doc.description && (
                    <p className="document-description">{doc.description}</p>
                  )}
                  <div className="document-details">
                    <span className="detail-label">Upload Date:</span>
                    <span className="detail-value">{formatDate(doc.uploadDate)}</span>
                  </div>
                  <div className="document-actions">
                    <a
                      href={doc.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-view-doc"
                    >
                      <Icon name="download" />
                      View/Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Company Documents Section */}
        {_isAdminUser && (
          <div className="company-documents-section">
            <div className="section-header-with-action">
              <div className="section-header">
                <Icon name="briefcase" />
                <h2>Company Documents</h2>
              </div>
              <button
                className="btn-upload-company"
                onClick={() => setShowCompanyUpload(!showCompanyUpload)}
              >
                <Icon name="upload" />
                {showCompanyUpload ? 'Cancel Upload' : 'Upload Document'}
              </button>
            </div>

            {/* Upload Form */}
            {showCompanyUpload && (
              <div className="company-upload-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Document Name *</label>
                    <input
                      type="text"
                      value={newCompanyDoc.name}
                      onChange={(e) => setNewCompanyDoc({ ...newCompanyDoc, name: e.target.value })}
                      placeholder="e.g., Company Policy, Insurance Certificate"
                      disabled={uploadingCompanyDoc}
                    />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={newCompanyDoc.expiryDate}
                      onChange={(e) => setNewCompanyDoc({ ...newCompanyDoc, expiryDate: e.target.value })}
                      disabled={uploadingCompanyDoc}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Description (Optional)</label>
                    <textarea
                      value={newCompanyDoc.description}
                      onChange={(e) => setNewCompanyDoc({ ...newCompanyDoc, description: e.target.value })}
                      placeholder="Brief description of the document"
                      rows={3}
                      disabled={uploadingCompanyDoc}
                    />
                  </div>
                  <div className="form-group">
                    <label>Warning Days Before Expiry</label>
                    <input
                      type="number"
                      value={newCompanyDoc.warningDays}
                      onChange={(e) => setNewCompanyDoc({ ...newCompanyDoc, warningDays: parseInt(e.target.value) || 30 })}
                      min="1"
                      max="365"
                      disabled={uploadingCompanyDoc}
                    />
                    <small>Show warning this many days before expiry</small>
                  </div>
                </div>
                <div className="form-group">
                  <label>Document File *</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          alert('File size must be less than 10MB');
                          return;
                        }
                        setNewCompanyDoc({ ...newCompanyDoc, file });
                      }
                    }}
                    disabled={uploadingCompanyDoc}
                  />
                </div>
                <div className="form-actions">
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setShowCompanyUpload(false);
                      setNewCompanyDoc({
                        name: '',
                        description: '',
                        expiryDate: '',
                        warningDays: 30,
                        file: null
                      });
                    }}
                    disabled={uploadingCompanyDoc}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-save"
                    onClick={uploadCompanyDocument}
                    disabled={uploadingCompanyDoc || !newCompanyDoc.name || !newCompanyDoc.file}
                  >
                    {uploadingCompanyDoc ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </div>
            )}

            {/* Company Documents List */}
            {companyDocuments.length === 0 ? (
              <div className="empty-state">
                <p>No company documents uploaded yet</p>
              </div>
            ) : (
              <div className="company-documents-grid">
                {companyDocuments.map((doc) => {
                  const isExpired = doc.expiryDate ? checkIsExpired(doc.expiryDate) : false;
                  const isExpiringSoon = doc.expiryDate ? checkIsExpiringSoon(doc.expiryDate, doc.warningDays || 30) : false;
                  const hasWarning = isExpired || isExpiringSoon;

                  return (
                    <div key={doc.id} className={`company-document-card ${hasWarning ? 'has-warning' : ''}`}>
                      <div className="company-doc-header">
                        <div className="company-doc-info">
                          <h3>{doc.name}</h3>
                          {doc.description && (
                            <p className="company-doc-description">{doc.description}</p>
                          )}
                        </div>
                        {hasWarning && (
                          <div className={`warning-badge ${isExpired ? 'expired' : 'expiring'}`}>
                            <Icon name="alert-circle" />
                            {isExpired ? 'Expired' : 'Expiring Soon'}
                          </div>
                        )}
                      </div>
                      <div className="company-doc-details">
                        <div className="detail-item">
                          <span className="detail-label">Upload Date:</span>
                          <span className="detail-value">{formatDate(doc.uploadDate)}</span>
                        </div>
                        {doc.expiryDate && (
                          <div className="detail-item">
                            <span className="detail-label">Expiry Date:</span>
                            <span className={`detail-value ${isExpired ? 'expired' : isExpiringSoon ? 'expiring-soon' : ''}`}>
                              {formatDate(doc.expiryDate)}
                            </span>
                          </div>
                        )}
                        <div className="detail-item">
                          <span className="detail-label">Uploaded By:</span>
                          <span className="detail-value">{doc.uploadedByName || 'Unknown'}</span>
                        </div>
                      </div>
                      <div className="company-doc-actions">
                        <a
                          href={doc.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-view-doc"
                        >
                          <Icon name="external-link" />
                          View Document
                        </a>
                        <button
                          className="btn-delete-doc"
                          onClick={() => deleteCompanyDocument(doc.id)}
                          title="Delete document"
                        >
                          <Icon name="trash-2" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Image Modal/Lightbox */}
        {selectedImage && (
          <div className="image-modal-overlay" onClick={closeImageModal}>
            <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="image-modal-close" onClick={closeImageModal}>
                <Icon name="x" />
              </button>
              <div className="image-modal-header">
                <h3>{selectedImage.title}</h3>
              </div>
              <div className="image-modal-body">
                <img src={selectedImage.url} alt={selectedImage.title} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;

