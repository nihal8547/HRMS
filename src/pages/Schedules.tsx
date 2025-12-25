import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { fetchUserRole, isAdmin } from '../utils/userRole';
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    employeeId: '',
    date: '',
    shiftStart: '',
    shiftEnd: '',
    status: 'scheduled'
  });
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await fetchStaffs();
        await fetchSchedules(user.uid, role);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchStaffs = async () => {
    try {
      const { fetchAllEmployees } = await import('../utils/fetchEmployees');
      const employees = await fetchAllEmployees();
      setStaffs(employees);
    } catch (error) {
      console.error('Error fetching staffs:', error);
    }
  };

  const fetchSchedules = async (uid: string, role: string) => {
    try {
      const adminUser = isAdmin(role);
      let snapshot;
      
      // Import fetchAllEmployees once at the top of the function
      const { fetchAllEmployees } = await import('../utils/fetchEmployees');
      const allEmployees = await fetchAllEmployees();
      
      if (adminUser) {
        snapshot = await getDocs(collection(db, 'schedules'));
      } else {
        // Get employeeId from employees/staffs collection
        const userEmployee = allEmployees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          snapshot = await getDocs(query(collection(db, 'schedules'), where('employeeId', '==', userEmployee.employeeId)));
        } else {
          snapshot = await getDocs(query(collection(db, 'schedules'), where('employeeId', '==', '')));
        }
      }
      
      const staffsMap = new Map(allEmployees.map(emp => [emp.employeeId, emp]));
      
      const schedulesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const staff = staffsMap.get(data.employeeId);
        return {
          id: doc.id,
          employeeId: data.employeeId,
          name: staff?.name || staff?.fullName || 'Unknown',
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
    if (!isAdminUser) {
      alert('Only administrators can create schedules.');
      return;
    }
    
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
      await fetchSchedules(currentUserId, userRole);
    } catch (error) {
      console.error('Error creating schedule:', error);
      setMessage('Error creating schedule. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdminUser) {
      alert('Only administrators can delete schedules.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
        await fetchSchedules(currentUserId, userRole);
      } catch (error) {
        console.error('Error deleting schedule:', error);
        alert('Error deleting schedule. Please try again.');
      }
    }
  };

  const handleView = (schedule: Schedule) => {
    alert(`Schedule Details:\nEmployee: ${schedule.name} (${schedule.employeeId})\nDate: ${schedule.date}\nShift: ${schedule.shiftStart} - ${schedule.shiftEnd}\nStatus: ${schedule.status}`);
  };

  const handleEdit = async (schedule: Schedule) => {
    if (!isAdminUser) {
      alert('Only administrators can edit schedules.');
      return;
    }
    
    // For now, show alert. Can be enhanced with edit modal
    const newStatus = prompt('Enter new status (scheduled/completed/cancelled):', schedule.status);
    if (newStatus && ['scheduled', 'completed', 'cancelled'].includes(newStatus)) {
      try {
        await updateDoc(doc(db, 'schedules', schedule.id), {
          status: newStatus,
          updatedAt: new Date()
        });
        await fetchSchedules(currentUserId, userRole);
      } catch (error) {
        console.error('Error updating schedule:', error);
        alert('Error updating schedule. Please try again.');
      }
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Employee ID', 'Name', 'Department', 'Date', 'Shift Start', 'Shift End', 'Status'],
      ...filteredSchedules.map(schedule => [
        schedule.employeeId,
        schedule.name,
        schedule.department,
        schedule.date,
        schedule.shiftStart,
        schedule.shiftEnd,
        schedule.status
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedules_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredSchedules = schedules.filter(schedule => {
    const matchesStatus = statusFilter === 'all' || schedule.status === statusFilter;
    const matchesSearch = 
      schedule.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.department.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="staff-management">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Duty Time Scheduling</h2>
          {isAdminUser && (
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
              {showForm ? 'Cancel' : '+ Create Schedule'}
            </button>
          )}
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
        <select 
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="action-buttons">
          <button className="btn-export" onClick={handleExport}>Export</button>
          {isAdminUser && (
            <button onClick={() => setShowForm(!showForm)} className="btn-new-record">
              {showForm ? 'Cancel' : 'New Record'}
            </button>
          )}
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
                      <button 
                        className="action-icon view" 
                        title="View"
                        onClick={() => handleView(schedule)}
                      >
                        <Icon name="view" />
                      </button>
                      {isAdminUser && (
                        <>
                          <button 
                            className="action-icon edit" 
                            title="Edit"
                            onClick={() => handleEdit(schedule)}
                          >
                            <Icon name="edit" />
                          </button>
                          <button 
                            className="action-icon delete" 
                            title="Delete"
                            onClick={() => handleDelete(schedule.id)}
                          >
                            <Icon name="delete" />
                          </button>
                        </>
                      )}
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

