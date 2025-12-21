import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import '../Staffs/StaffCreate.css';

const ItemUsing = () => {
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    itemName: '',
    quantity: '',
    unit: '',
    purpose: '',
    expectedReturnDate: '',
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
      await addDoc(collection(db, 'requests'), {
        ...formData,
        type: 'using',
        createdAt: new Date(),
        submittedAt: new Date()
      });
      setMessage('Item using request submitted successfully!');
      setFormData({
        employeeId: '',
        name: '',
        itemName: '',
        quantity: '',
        unit: '',
        purpose: '',
        expectedReturnDate: '',
        status: 'pending'
      });
    } catch (error) {
      console.error('Error submitting request:', error);
      setMessage('Error submitting request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-create">
      <h2>Item Using Request</h2>
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
            <label>Item Name *</label>
            <input
              type="text"
              name="itemName"
              value={formData.itemName}
              onChange={handleChange}
              required
              placeholder="e.g., Medical Equipment, Tools"
            />
          </div>
          <div className="form-group">
            <label>Expected Return Date *</label>
            <input
              type="date"
              name="expectedReturnDate"
              value={formData.expectedReturnDate}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              required
              min="1"
            />
          </div>
          <div className="form-group">
            <label>Unit *</label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              required
            >
              <option value="">Select Unit</option>
              <option value="pieces">Pieces</option>
              <option value="boxes">Boxes</option>
              <option value="units">Units</option>
              <option value="sets">Sets</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Purpose *</label>
          <textarea
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            rows={4}
            required
            placeholder="Please describe the purpose for using this item..."
          />
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
};

export default ItemUsing;







