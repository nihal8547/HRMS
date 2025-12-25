import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { fetchUserRole, isAdmin } from '../utils/userRole';
import Icon from '../components/Icons';
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

type SortOption = 'name-asc' | 'name-desc' | 'id-asc' | 'id-desc';

const Documents = () => {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<EmployeeDocument[]>([]);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [currentUserData, setCurrentUserData] = useState<EmployeeDocument | null>(null);
  const [stats, setStats] = useState({
    expiredDocuments: 0,
    expiringSoon: 0,
    totalDocuments: 0,
    daysUntilBirthday: 0
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await fetchDocuments(user.uid, role);
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

    const daysUntilBirthday = userDoc ? calculateDaysUntilBirthday(userDoc.dateOfBirth) : 0;

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
                        <img src={doc.qidImageUrl} alt="QID" className="document-image" />
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
                        <img src={doc.passportImageUrl} alt="Passport" className="document-image" />
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
                        <img src={doc.medicalLicenseImageUrl} alt="Medical License" className="document-image" />
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
      </div>
    </div>
  );
};

export default Documents;

