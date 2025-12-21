import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Icon from '../components/Icons';
import './Staffs/StaffManagement.css';

interface Schedule {
  id: string;
  employeeId: string;
  name: string;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  department: string;
  status: string;
}

const Schedules = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [staffs, setStaffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    employeeId: '',
    date: '',
    shiftStart: '',
    shiftEnd: '',
    status: 'scheduled'
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStaffs();
    fetchSchedules();
  }, []);

  const fetchStaffs = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'staffs'));
      setStaffs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching staffs:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'schedules'));
      const staffsSnapshot = await getDocs(collection(db, 'staffs'));
      const staffsMap = new Map(staffsSnapshot.docs.map(doc => [doc.data().employeeId, doc.data()]));
      
      const schedulesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const staff = staffsMap.get(data.employeeId);
        return {
          id: doc.id,
          employeeId: data.employeeId,
          name: staff?.name || 'Unknown',
          date: data.date,
          shiftStart: data.shiftStart,
          shiftEnd: data.shiftEnd,
          department: staff?.department || '',
          status: data.status || 'scheduled'
        };
      }) as Schedule[];
      
      setSchedules(schedulesData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      await addDoc(collection(db, 'schedules'), {
        ...formData,
        createdAt: new Date()
      });
      setMessage('Schedule created successfully!');
      setFormData({
        employeeId: '',
        date: '',
        shiftStart: '',
        shiftEnd: '',
        status: 'scheduled'
      });
      setShowForm(false);
      fetchSchedules();
    } catch (error) {
      console.error('Error creating schedule:', error);
      setMessage('Error creating schedule. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
        fetchSchedules();
      } catch (error) {
        console.error('Error deleting schedule:', error);
      }
    }
  };

  const filteredSchedules = schedules.filter(schedule =>
    schedule.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    schedule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    schedule.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="staff-management">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Duty Time Scheduling</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            {showForm ? 'Cancel' : '+ Create Schedule'}
          </button>
        </div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management">
      <h2 style={{ marginBottom: '24px', color: '#1f2937', fontSize: '1.75rem', fontWeight: '600' }}>Duty Time Scheduling</h2>

      {showForm && (
        <div className="staff-table-container" style={{ marginBottom: '20px' }}>
          <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
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
                <label>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Shift Start *</label>
                <input
                  type="time"
                  name="shiftStart"
                  value={formData.shiftStart}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Shift End *</label>
                <input
                  type="time"
                  name="shiftEnd"
                  value={formData.shiftEnd}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            {message && (
              <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}
            <button type="submit" className="btn btn-primary">Create Schedule</button>
          </form>
        </div>
      )}

      <div className="management-header">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Search schedules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <select className="filter-select">
          <option>All Status</option>
          <option>Scheduled</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </select>
        <select className="filter-select">
          <option>Last 30 days</option>
          <option>Last 7 days</option>
          <option>Last 90 days</option>
          <option>All time</option>
        </select>
        <div className="action-buttons">
          <button className="btn-export">Export</button>
          <button onClick={() => setShowForm(!showForm)} className="btn-new-record">
            {showForm ? 'Cancel' : 'New Record'}
          </button>
        </div>
      </div>

      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Department</th>
              <th>Date</th>
              <th>Shift Start</th>
              <th>Shift End</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-data">No schedules found</td>
              </tr>
            ) : (
              filteredSchedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>{schedule.employeeId}</td>
                  <td>{schedule.name}</td>
                  <td>{schedule.department}</td>
                  <td>{schedule.date}</td>
                  <td>{schedule.shiftStart}</td>
                  <td>{schedule.shiftEnd}</td>
                  <td>
                    <span className={`status-badge ${schedule.status}`}>
                      {schedule.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-icons">
                      <button className="action-icon view" title="View">
                        <Icon name="view" />
                      </button>
                      <button className="action-icon edit" title="Edit">
                        <Icon name="edit" />
                      </button>
                      <button 
                        className="action-icon delete" 
                        title="Delete"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Icon name="delete" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Schedules;

