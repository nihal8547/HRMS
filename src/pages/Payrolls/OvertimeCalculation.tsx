import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
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

  useEffect(() => {
    fetchPayrollSettings();
    fetchOvertimeRecords();
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

  const fetchOvertimeRecords = async () => {
    try {
      const overtimeSnapshot = await getDocs(collection(db, 'overtime'));
      const staffsSnapshot = await getDocs(collection(db, 'staffs'));
      const staffsMap = new Map(staffsSnapshot.docs.map(doc => [doc.data().employeeId, doc.data()]));
      
      const records: OvertimeRecord[] = [];
      overtimeSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const staff = staffsMap.get(data.employeeId);
        const rate = payrollSettings?.overtimeRate || data.rate || 0;
        records.push({
          id: doc.id,
          employeeId: data.employeeId,
          name: staff?.name || 'Unknown',
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
    if (payrollSettings) {
      fetchOvertimeRecords();
    }
  }, [payrollSettings]);

  const totalOvertime = overtimeRecords.reduce((sum, record) => sum + record.total, 0);

  if (loading) {
    return (
      <div className="staff-management">
        <h2>Overtime Calculation</h2>
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading overtime calculations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management">
      <h2>Overtime Calculation</h2>
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
  );
};

export default OvertimeCalculation;

