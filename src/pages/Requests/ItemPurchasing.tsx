import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import '../Staffs/StaffCreate.css';

const ItemPurchasing = () => {
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    itemName: '',
    quantity: '',
    unit: '',
    estimatedCost: '',
    reason: '',
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
      await addDoc(collection(db, 'requests'), {
        ...formData,
        type: 'purchasing',
        createdAt: new Date(),
        submittedAt: new Date()
      });
      setMessage('Purchasing request submitted successfully!');
      setFormData({
        employeeId: '',
        name: '',
        itemName: '',
        quantity: '',
        unit: '',
        estimatedCost: '',
        reason: '',
        priority: 'medium',
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
      <h2>Item Purchasing Request</h2>
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
              placeholder="e.g., Medical Equipment, Supplies"
            />
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

        <div className="form-row">
          <div className="form-group">
            <label>Estimated Cost *</label>
            <input
              type="number"
              name="estimatedCost"
              value={formData.estimatedCost}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Reason/Purpose *</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows={4}
            required
            placeholder="Please provide a reason for this purchasing request..."
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

export default ItemPurchasing;







