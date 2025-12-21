import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
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

  useEffect(() => {
    fetchStaffs();
  }, []);

  const fetchStaffs = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'staffs'));
      setStaffs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
      setFormData({
        employeeId: '',
        name: '',
        complaintType: '',
        subject: '',
        description: '',
        priority: 'medium',
        status: 'pending'
      });
    } catch (error) {
      console.error('Error registering complaint:', error);
      setMessage('Error registering complaint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-create">
      <h2>Register Complaint</h2>
      <form onSubmit={handleSubmit} className="staff-form">
        <div className="form-row">
          <div className="form-group">
            <label>Employee ID *</label>
            <select
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              required
            >
              <option value="">Select Employee</option>
              {staffs.map(staff => (
                <option key={staff.id} value={staff.employeeId}>
                  {staff.employeeId} - {staff.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Employee Name</label>
            <input
              type="text"
              value={formData.name}
              readOnly
              style={{ background: '#f3f4f6' }}
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
  );
};

export default ComplaintRegistration;







