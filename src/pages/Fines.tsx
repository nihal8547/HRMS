import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { fetchUserRole, isAdmin } from '../utils/userRole';
import Icon from '../components/Icons';
import './Staffs/StaffManagement.css';
import './Fines.css';

interface Fine {
  id?: string;
  employeeId: string;
  employeeName: string;
  reason: string;
  imageUrl?: string;
  status: 'pending' | 'accepted' | 'declined';
  declineReason?: string;
  createdAt: any;
  updatedAt?: any;
  createdBy: string;
  createdByName?: string;
}

const Fines = () => {
  const [fines, setFines] = useState<Fine[]>([]);
  const [filteredFines, setFilteredFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    reason: '',
    imageFile: null as File | null,
    imagePreview: null as string | null
  });
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [decliningFine, setDecliningFine] = useState<Fine | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await fetchCurrentUserData(user.uid, isAdmin(role));
        await fetchEmployees();
        await fetchFines(user.uid, role);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterFines();
  }, [fines, searchTerm, statusFilter]);

  const fetchCurrentUserData = async (uid: string, isAdmin: boolean) => {
    try {
      if (isAdmin) {
        setCurrentUserData(null);
        return;
      }

      const { fetchAllEmployees } = await import('../utils/fetchEmployees');
      const allEmployees = await fetchAllEmployees();
      const userEmployee = allEmployees.find(emp => 
        emp.id === uid || emp.authUserId === uid
      );
      setCurrentUserData(userEmployee);
    } catch (error) {
      console.error('Error fetching current user data:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { fetchAllEmployees } = await import('../utils/fetchEmployees');
      const allEmployees = await fetchAllEmployees();
      setEmployees(allEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchFines = async (uid: string, role: string) => {
    try {
      setLoading(true);
      let snapshot;

      if (isAdmin(role)) {
        snapshot = await getDocs(query(collection(db, 'fines'), orderBy('createdAt', 'desc')));
      } else {
        const { fetchAllEmployees } = await import('../utils/fetchEmployees');
        const allEmployees = await fetchAllEmployees();
        const userEmployee = allEmployees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          snapshot = await getDocs(query(
            collection(db, 'fines'),
            where('employeeId', '==', userEmployee.employeeId),
            orderBy('createdAt', 'desc')
          ));
        } else {
          snapshot = await getDocs(query(
            collection(db, 'fines'),
            where('employeeId', '==', ''),
            orderBy('createdAt', 'desc')
          ));
        }
      }

      const finesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Fine[];

      setFines(finesData);
    } catch (error) {
      console.error('Error fetching fines:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterFines = () => {
    let filtered = [...fines];

    if (searchTerm) {
      filtered = filtered.filter(f =>
        f.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }

    setFilteredFines(filtered);
  };

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find(emp => emp.employeeId === employeeId);
    if (employee) {
      setFormData(prev => ({
        ...prev,
        employeeId,
        employeeName: employee.name || employee.fullName || ''
      }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      setFormData(prev => ({
        ...prev,
        imageFile: file,
        imagePreview: URL.createObjectURL(file)
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.reason.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setUploading(true);
    try {
      let imageUrl = '';

      // Upload image if provided
      if (formData.imageFile) {
        const imageRef = ref(storage, `fines/${Date.now()}_${formData.imageFile.name}`);
        await uploadBytes(imageRef, formData.imageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      // Get current user name
      const { fetchAllEmployees } = await import('../utils/fetchEmployees');
      const allEmployees = await fetchAllEmployees();
      const currentUserEmp = allEmployees.find(emp => 
        emp.id === currentUserId || emp.authUserId === currentUserId
      );
      const createdByName = currentUserEmp?.name || currentUserEmp?.fullName || 'Admin';

      const fineData: Omit<Fine, 'id'> = {
        employeeId: formData.employeeId,
        employeeName: formData.employeeName,
        reason: formData.reason.trim(),
        imageUrl: imageUrl || undefined,
        status: 'pending',
        createdAt: new Date(),
        createdBy: currentUserId,
        createdByName
      };

      await addDoc(collection(db, 'fines'), fineData);

      alert('Fine created successfully!');
      setShowForm(false);
      resetForm();
      await fetchFines(currentUserId, userRole);
    } catch (error) {
      console.error('Error creating fine:', error);
      alert('Error creating fine. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAccept = async (fine: Fine) => {
    if (!window.confirm('Are you sure you want to accept this fine?')) {
      return;
    }

    try {
      await updateDoc(doc(db, 'fines', fine.id!), {
        status: 'accepted',
        updatedAt: new Date()
      });
      await fetchFines(currentUserId, userRole);
    } catch (error) {
      console.error('Error accepting fine:', error);
      alert('Error accepting fine. Please try again.');
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      alert('Please provide a reason for declining');
      return;
    }

    if (!decliningFine?.id) return;

    try {
      await updateDoc(doc(db, 'fines', decliningFine.id), {
        status: 'declined',
        declineReason: declineReason.trim(),
        updatedAt: new Date()
      });
      setDecliningFine(null);
      setDeclineReason('');
      await fetchFines(currentUserId, userRole);
    } catch (error) {
      console.error('Error declining fine:', error);
      alert('Error declining fine. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      employeeName: '',
      reason: '',
      imageFile: null,
      imagePreview: null
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  if (loading && fines.length === 0) {
    return (
      <div className="full-page">
        <div className="staff-management">
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Loading fines...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-page">
      <div className="staff-management fines-management">
        <div className="management-header-section">
          <h2 style={{ marginBottom: '24px', color: '#1f2937', fontSize: '1.75rem', fontWeight: '600' }}>
            Fines Management
          </h2>
          <div className="management-header">
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Search by Employee ID, Name, or Reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
            {isAdminUser && (
              <button className="btn-new-record" onClick={() => setShowForm(true)}>
                <Icon name="plus" />
                New Fine
              </button>
            )}
          </div>
        </div>

        {showForm && isAdminUser && (
          <div className="fine-form-modal">
            <div className="fine-form-content">
              <div className="form-header">
                <h3>Create New Fine</h3>
                <button className="close-btn" onClick={() => { setShowForm(false); resetForm(); }}>×</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Employee *</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.employeeId}>
                        {emp.employeeId} - {emp.name || emp.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Reason *</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    required
                    rows={4}
                    placeholder="Enter the reason for the fine..."
                  />
                </div>
                <div className="form-group">
                  <label>Image (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input"
                  />
                  {formData.imagePreview && (
                    <div className="image-preview">
                      <img src={formData.imagePreview} alt="Preview" />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, imageFile: null, imagePreview: null }))}
                        className="remove-image-btn"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? 'Creating...' : 'Create Fine'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {decliningFine && (
          <div className="fine-form-modal">
            <div className="fine-form-content">
              <div className="form-header">
                <h3>Decline Fine</h3>
                <button className="close-btn" onClick={() => { setDecliningFine(null); setDeclineReason(''); }}>×</button>
              </div>
              <div className="decline-form">
                <p><strong>Reason for Fine:</strong> {decliningFine.reason}</p>
                <div className="form-group">
                  <label>Your Reason for Declining *</label>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    required
                    rows={4}
                    placeholder="Enter your reason for declining this fine..."
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-primary" onClick={handleDecline}>
                    Submit Decline
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setDecliningFine(null); setDeclineReason(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="fines-container">
          {filteredFines.length === 0 ? (
            <div className="no-data-message">
              <p>No fines found</p>
            </div>
          ) : (
            <div className="fines-grid">
              {filteredFines.map((fine) => (
                <div key={fine.id} className="fine-card">
                  <div className="fine-card-header">
                    <div>
                      <h3>{fine.employeeName}</h3>
                      <p className="employee-id">{fine.employeeId}</p>
                    </div>
                    <span className={`status-badge ${fine.status}`}>
                      {fine.status}
                    </span>
                  </div>
                  <div className="fine-card-body">
                    <div className="fine-reason">
                      <strong>Reason:</strong>
                      <p>{fine.reason}</p>
                    </div>
                    {fine.imageUrl && (
                      <div className="fine-image">
                        <img 
                          src={fine.imageUrl} 
                          alt="Fine evidence" 
                          onClick={() => window.open(fine.imageUrl, '_blank')}
                        />
                      </div>
                    )}
                    {fine.declineReason && (
                      <div className="decline-reason">
                        <strong>Decline Reason:</strong>
                        <p>{fine.declineReason}</p>
                      </div>
                    )}
                    <div className="fine-meta">
                      <p><strong>Created:</strong> {formatDate(fine.createdAt)}</p>
                      {fine.createdByName && (
                        <p><strong>By:</strong> {fine.createdByName}</p>
                      )}
                    </div>
                  </div>
                  {!isAdminUser && fine.status === 'pending' && (
                    <div className="fine-card-actions">
                      <button
                        className="btn-accept"
                        onClick={() => handleAccept(fine)}
                      >
                        <Icon name="check" />
                        Accept
                      </button>
                      <button
                        className="btn-decline"
                        onClick={() => setDecliningFine(fine)}
                      >
                        <Icon name="x" />
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Fines;

