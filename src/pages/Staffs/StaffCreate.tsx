import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin } from '../../utils/userRole';
import { fetchAllEmployees } from '../../utils/fetchEmployees';
import Icon from '../../components/Icons';
import './StaffCreate.css';

interface StaffFormData {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  department: string;
  position: string;
  employeeType: string;
  salary: string;
  joinDate: string;
  status: string;
}

const StaffCreate = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<StaffFormData>({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    department: '',
    position: '',
    employeeType: '',
    salary: '',
    joinDate: new Date().toISOString().split('T')[0],
    status: 'active'
  });
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        const adminStatus = isAdmin(role);
        setUserRole(role);
        setIsAdminUser(adminStatus);
        
        if (!adminStatus) {
          setMessage('You do not have permission to create staff. Only admins can create staff members.');
          setTimeout(() => navigate('/staffs'), 2000);
          return;
        }
        
        await fetchDepartments();
        await generateNextEmployeeId();
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchLastEmployeeId = async (): Promise<number> => {
    try {
      // Check both 'staffs' and 'employees' collections for both 'EMP' and 'FMC' prefixes
      const collections = ['staffs', 'employees'];
      let maxNumber = 0;

      for (const collectionName of collections) {
        const q = query(
          collection(db, collectionName),
          orderBy('employeeId', 'desc'),
          limit(100)
        );
        const snapshot = await getDocs(q);
        
        snapshot.docs.forEach(doc => {
          const employeeId = doc.data().employeeId || '';
          // Check for both EMP and FMC prefixes
          if (employeeId.startsWith('EMP')) {
            const number = parseInt(employeeId.replace('EMP', ''));
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number;
            }
          } else if (employeeId.startsWith('FMC')) {
            const number = parseInt(employeeId.replace('FMC', ''));
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number;
            }
          }
        });
      }

      return maxNumber;
    } catch (error) {
      console.error('Error fetching last employee ID:', error);
      return 0;
    }
  };

  const generateNextEmployeeId = async () => {
    try {
      const lastNumber = await fetchLastEmployeeId();
      const nextNumber = lastNumber + 1;
      const employeeId = `FMC${nextNumber.toString().padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, employeeId }));
    } catch (error) {
      console.error('Error generating employee ID:', error);
      setMessage('Failed to generate Employee ID. Please try again.');
    }
  };

  const fetchDepartments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'departments'));
      const depts = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setDepartments(depts);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone || !formData.department || 
        !formData.position || !formData.employeeType || !formData.salary) {
      setMessage('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessage('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    // Check if email already exists
    try {
      const employees = await fetchAllEmployees();
      const emailExists = employees.some(emp => 
        emp.email?.toLowerCase() === formData.email.toLowerCase()
      );
      
      if (emailExists) {
        setMessage('An employee with this email already exists.');
        setLoading(false);
        return;
      }

      // Check if employee ID already exists
      const employeeIdExists = employees.some(emp => 
        emp.employeeId === formData.employeeId
      );
      
      if (employeeIdExists) {
        setMessage('An employee with this Employee ID already exists. Please regenerate the ID.');
        await generateNextEmployeeId();
        setLoading(false);
        return;
      }

      // Create staff document
      await addDoc(collection(db, 'staffs'), {
        ...formData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setMessage('Staff created successfully!');
      setTimeout(() => {
        navigate('/staffs');
      }, 1500);
    } catch (error: any) {
      console.error('Error creating staff:', error);
      setMessage(error.message || 'Failed to create staff. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminUser) {
    return (
      <div className="full-page">
        <div className="staff-create">
          <div className="page-header-with-back">
            <button className="back-button" onClick={() => navigate('/staffs')}>
              <Icon name="chevron-left" /> Back
            </button>
            <h2>Create New Staff</h2>
          </div>
          <div className="message error">{message || 'You do not have permission to create staff.'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-page">
      <div className="staff-create">
        <div className="page-header-with-back">
          <button className="back-button" onClick={() => navigate('/staffs')}>
            <Icon name="chevron-left" /> Back
          </button>
          <h2>Create New Staff</h2>
        </div>

        {message && (
          <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <form className="staff-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Employee ID *</label>
              <div className="employee-id-container">
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  readOnly
                  style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                />
                <button
                  type="button"
                  onClick={generateNextEmployeeId}
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Regenerate
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Join Date *</label>
              <input
                type="date"
                name="joinDate"
                value={formData.joinDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                onKeyPress={(e) => {
                  if (/\d/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
                pattern="[A-Za-z\s]+"
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Gender *</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Department *</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Position *</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Employee Type *</label>
              <select
                name="employeeType"
                value={formData.employeeType}
                onChange={handleChange}
                required
              >
                <option value="">Select Type</option>
                <option value="full-time">Full Time</option>
                <option value="part-time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Salary (QAR) *</label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label>Status *</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/staffs')}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffCreate;
