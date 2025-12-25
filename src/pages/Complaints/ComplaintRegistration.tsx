import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin } from '../../utils/userRole';
import { fetchAllEmployees } from '../../utils/fetchEmployees';
import Icon from '../../components/Icons';
import '../Staffs/StaffCreate.css';

const ComplaintRegistration = () => {
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    complaintType: '',
    subject: '',
    description: '',
    priority: 'medium',
    status: 'pending'
  });
  const [staffs, setStaffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [_currentUserId, setCurrentUserId] = useState<string>('');
  const [_userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        const adminStatus = isAdmin(role);
        setUserRole(role);
        setIsAdminUser(adminStatus);
        await fetchCurrentUserData(user.uid, adminStatus);
        await fetchStaffs();
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchCurrentUserData = async (uid: string, isAdmin: boolean) => {
    try {
      // Try to fetch from employees collection
      const employeeDoc = await getDoc(doc(db, 'employees', uid));
      if (employeeDoc.exists()) {
        const data = employeeDoc.data();
        setCurrentUserData({
          employeeId: data.employeeId || '',
          name: data.fullName || data.name || ''
        });
        // Auto-populate form for non-admin users
        if (!isAdmin) {
          setFormData(prev => ({
            ...prev,
            employeeId: data.employeeId || '',
            name: data.fullName || data.name || ''
          }));
        }
        return;
      }

      // Try staffs collection by authUserId
      const staffQuery = query(collection(db, 'staffs'), where('authUserId', '==', uid));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        const data = staffSnapshot.docs[0].data();
        setCurrentUserData({
          employeeId: data.employeeId || '',
          name: data.name || ''
        });
        // Auto-populate form for non-admin users
        if (!isAdmin) {
          setFormData(prev => ({
            ...prev,
            employeeId: data.employeeId || '',
            name: data.name || ''
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching current user data:', error);
    }
  };

  const fetchStaffs = async () => {
    try {
      const employees = await fetchAllEmployees();
      setStaffs(employees);
    } catch (error) {
      console.error('Error fetching staffs:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'employeeId' && {
        name: staffs.find(s => s.employeeId === value)?.name || ''
      })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await addDoc(collection(db, 'complaints'), {
        ...formData,
        createdAt: new Date(),
        submittedAt: new Date()
      });
      setMessage('Complaint registered successfully!');
      // Reset form but keep employee data for non-admin users
      if (isAdminUser) {
        setFormData({
          employeeId: '',
          name: '',
          complaintType: '',
          subject: '',
          description: '',
          priority: 'medium',
          status: 'pending'
        });
      } else {
        setFormData({
          employeeId: currentUserData?.employeeId || '',
          name: currentUserData?.name || '',
          complaintType: '',
          subject: '',
          description: '',
          priority: 'medium',
          status: 'pending'
        });
      }
    } catch (error) {
      console.error('Error registering complaint:', error);
      setMessage('Error registering complaint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="full-page">
      <div className="staff-create">
        <div className="page-header-with-back">
          <button className="back-button" onClick={() => navigate('/complaints')}>
            <Icon name="chevron-left" /> Back
          </button>
          <h2>Register Complaint</h2>
        </div>
      <form onSubmit={handleSubmit} className="staff-form">
        <div className="form-row">
          <div className="form-group">
            <label>Employee ID *</label>
            {isAdminUser ? (
              <select
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                required
              >
                <option value="">Select Employee</option>
                {staffs.map(staff => (
                  <option key={staff.id} value={staff.employeeId}>
                    {staff.employeeId} - {staff.name || staff.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.employeeId}
                readOnly
                disabled
                style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                required
              />
            )}
          </div>
          <div className="form-group">
            <label>Employee Name</label>
            <input
              type="text"
              value={formData.name}
              readOnly
              disabled
              style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Complaint Type *</label>
            <select
              name="complaintType"
              value={formData.complaintType}
              onChange={handleChange}
              required
            >
              <option value="">Select Type</option>
              <option value="Workplace">Workplace Issue</option>
              <option value="Equipment">Equipment Problem</option>
              <option value="Staff">Staff Related</option>
              <option value="Patient">Patient Related</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label>Priority *</label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              required
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Subject *</label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            placeholder="Brief subject of the complaint"
          />
        </div>

        <div className="form-group">
          <label>Description *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={6}
            required
            placeholder="Please provide detailed description of the complaint..."
          />
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Registering...' : 'Register Complaint'}
        </button>
      </form>
      </div>
    </div>
  );
};

export default ComplaintRegistration;








