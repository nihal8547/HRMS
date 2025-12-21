import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import './Staffs/StaffCreate.css';

const Overtime = () => {
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    date: '',
    hours: '',
    reason: '',
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
      await addDoc(collection(db, 'overtime'), {
        ...formData,
        hours: parseFloat(formData.hours),
        createdAt: new Date(),
        submittedAt: new Date()
      });
      setMessage('Overtime submission successful!');
      setFormData({
        employeeId: '',
        name: '',
        date: '',
        hours: '',
        reason: '',
        status: 'pending'
      });
    } catch (error) {
      console.error('Error submitting overtime:', error);
      setMessage('Error submitting overtime. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-create">
      <h2>Overtime Submission</h2>
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
            <label>Date *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Hours *</label>
            <input
              type="number"
              name="hours"
              value={formData.hours}
              onChange={handleChange}
              required
              min="0.5"
              step="0.5"
              placeholder="0.0"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Reason *</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows={4}
            required
            placeholder="Please provide a reason for overtime work..."
          />
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Overtime'}
        </button>
      </form>
    </div>
  );
};

export default Overtime;







