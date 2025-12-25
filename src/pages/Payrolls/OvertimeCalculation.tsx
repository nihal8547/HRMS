import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin } from '../../utils/userRole';
import Icon from '../../components/Icons';
import '../Staffs/StaffManagement.css';

interface OvertimeRecord {
  id: string;
  employeeId: string;
  name: string;
  hours: number;
  date: string;
  rate: number;
  total: number;
}

const OvertimeCalculation = () => {
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [payrollSettings, setPayrollSettings] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await fetchPayrollSettings();
        await fetchOvertimeRecords(user.uid, role);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchPayrollSettings = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'payrollSettings'));
      if (!snapshot.empty) {
        setPayrollSettings(snapshot.docs[0].data());
      }
    } catch (error) {
      console.error('Error fetching payroll settings:', error);
    }
  };

  const fetchOvertimeRecords = async (uid: string, role: string) => {
    try {
      const adminUser = isAdmin(role);
      let overtimeSnapshot;
      
      // Import fetchAllEmployees once at the top of the function
      const { fetchAllEmployees } = await import('../../utils/fetchEmployees');
      const allEmployees = await fetchAllEmployees();
      
      if (adminUser) {
        overtimeSnapshot = await getDocs(collection(db, 'overtime'));
      } else {
        // Get employeeId from employees/staffs collection
        const userEmployee = allEmployees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          overtimeSnapshot = await getDocs(query(collection(db, 'overtime'), where('employeeId', '==', userEmployee.employeeId)));
        } else {
          overtimeSnapshot = await getDocs(query(collection(db, 'overtime'), where('employeeId', '==', '')));
        }
      }
      
      const staffsMap = new Map(allEmployees.map(emp => [emp.employeeId, emp]));
      
      const records: OvertimeRecord[] = [];
      overtimeSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const staff = staffsMap.get(data.employeeId);
        const rate = payrollSettings?.overtimeRate || data.rate || 0;
        records.push({
          id: doc.id,
          employeeId: data.employeeId,
          name: staff?.name || staff?.fullName || 'Unknown',
          hours: data.hours || 0,
          date: data.date || '',
          rate: rate,
          total: (data.hours || 0) * rate
        });
      });
      
      setOvertimeRecords(records);
    } catch (error) {
      console.error('Error fetching overtime records:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (payrollSettings && currentUserId && userRole) {
      fetchOvertimeRecords(currentUserId, userRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payrollSettings, currentUserId, userRole]);

  const totalOvertime = overtimeRecords.reduce((sum, record) => sum + record.total, 0);

  if (loading) {
    return (
      <div className="full-page">
        <div className="staff-management">
          <div className="page-header-with-back">
            <button className="back-button" onClick={() => navigate('/payrolls')}>
              <Icon name="chevron-left" /> Back
            </button>
            <h2>Overtime Calculation</h2>
          </div>
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Loading overtime calculations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-page">
      <div className="staff-management">
        <div className="page-header-with-back">
          <button className="back-button" onClick={() => navigate('/payrolls')}>
            <Icon name="chevron-left" /> Back
            <Icon name="chevron-left" /> Back
          </button>
          <h2>Overtime Calculation</h2>
        </div>
      <div className="management-header">
        <div className="overtime-summary">
          <strong>Total Overtime Payment: ${totalOvertime.toFixed(2)}</strong>
        </div>
      </div>
      <div className="staff-table-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Date</th>
              <th>Hours</th>
              <th>Rate ($/hr)</th>
              <th>Total ($)</th>
            </tr>
          </thead>
          <tbody>
            {overtimeRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-data">No overtime records found</td>
              </tr>
            ) : (
              overtimeRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.employeeId}</td>
                  <td>{record.name}</td>
                  <td>{record.date}</td>
                  <td>{record.hours}</td>
                  <td>${record.rate.toFixed(2)}</td>
                  <td><strong>${record.total.toFixed(2)}</strong></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
};

export default OvertimeCalculation;

