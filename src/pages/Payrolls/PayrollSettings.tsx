import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Icon from '../../components/Icons';
import '../Staffs/StaffCreate.css';

const PayrollSettings = () => {
  const [settings, setSettings] = useState({
    baseSalary: '',
    taxRate: '',
    overtimeRate: '',
    bonusRate: '',
    deductionRate: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'payrollSettings'));
      if (!snapshot.empty) {
        const settingsData = snapshot.docs[0].data();
        setSettings({
          baseSalary: settingsData.baseSalary || '',
          taxRate: settingsData.taxRate || '',
          overtimeRate: settingsData.overtimeRate || '',
          bonusRate: settingsData.bonusRate || '',
          deductionRate: settingsData.deductionRate || ''
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const snapshot = await getDocs(collection(db, 'payrollSettings'));
      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, {
          ...settings,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'payrollSettings'), {
          ...settings,
          createdAt: new Date()
        });
      }
      setMessage('Payroll settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Error saving settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="full-page">
      <div className="staff-create">
        <div className="page-header-with-back">
          <button className="back-button" onClick={() => navigate('/payrolls')}>
          <Icon name="chevron-left" /> Back
          </button>
          <h2>Payroll Settings</h2>
        </div>
      <form onSubmit={handleSubmit} className="staff-form">
        <div className="form-row">
          <div className="form-group">
            <label>Base Salary (per month) *</label>
            <input
              type="number"
              name="baseSalary"
              value={settings.baseSalary}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label>Tax Rate (%) *</label>
            <input
              type="number"
              name="taxRate"
              value={settings.taxRate}
              onChange={handleChange}
              required
              min="0"
              max="100"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Overtime Rate (per hour) *</label>
            <input
              type="number"
              name="overtimeRate"
              value={settings.overtimeRate}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label>Bonus Rate (%) *</label>
            <input
              type="number"
              name="bonusRate"
              value={settings.bonusRate}
              onChange={handleChange}
              required
              min="0"
              max="100"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Deduction Rate (%) *</label>
            <input
              type="number"
              name="deductionRate"
              value={settings.deductionRate}
              onChange={handleChange}
              required
              min="0"
              max="100"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
      </div>
    </div>
  );
};

export default PayrollSettings;








