import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { fetchUserRole, isAdmin } from '../../utils/userRole';
import * as XLSX from 'xlsx';
import Icon from '../../components/Icons';
import '../Staffs/StaffManagement.css';
import './PayrollManagement.css';

interface PayrollRecord {
  id?: string;
  employeeId: string;
  employeeName: string;
  month: string;
  year: string;
  baseSalary: number;
  overtimeHours: number;
  overtimeAmount: number;
  bonus: number;
  deductions: number;
  tax: number;
  grossSalary: number;
  netSalary: number;
  status: 'pending' | 'approved' | 'paid';
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface PayrollSettings {
  baseSalary: number;
  taxRate: number;
  overtimeRate: number;
  bonusRate: number;
  deductionRate: number;
}

const PayrollManagement = () => {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [filteredPayrolls, setFilteredPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [formData, setFormData] = useState<PayrollRecord>({
    employeeId: '',
    employeeName: '',
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    baseSalary: 0,
    overtimeHours: 0,
    overtimeAmount: 0,
    bonus: 0,
    deductions: 0,
    tax: 0,
    grossSalary: 0,
    netSalary: 0,
    status: 'pending',
    notes: ''
  });
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await Promise.all([
          fetchPayrollSettings(),
          fetchEmployees(),
          fetchPayrolls(user.uid, role)
        ]);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterPayrolls();
  }, [payrolls, searchTerm, monthFilter, yearFilter, statusFilter]);

  const fetchPayrollSettings = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'payrollSettings'));
      if (!snapshot.empty) {
        const settings = snapshot.docs[0].data() as PayrollSettings;
        setPayrollSettings(settings);
        // Set default base salary in form
        if (settings.baseSalary) {
          setFormData(prev => ({ ...prev, baseSalary: parseFloat(settings.baseSalary.toString()) }));
        }
      }
    } catch (error) {
      console.error('Error fetching payroll settings:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { fetchAllEmployees } = await import('../../utils/fetchEmployees');
      const allEmployees = await fetchAllEmployees();
      setEmployees(allEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchPayrolls = async (uid: string, role: string) => {
    try {
      setLoading(true);
      const adminUser = isAdmin(role);
      let snapshot;

      if (adminUser) {
        snapshot = await getDocs(collection(db, 'payrolls'));
      } else {
        const { fetchAllEmployees } = await import('../../utils/fetchEmployees');
        const allEmployees = await fetchAllEmployees();
        const userEmployee = allEmployees.find(emp => 
          emp.id === uid || emp.authUserId === uid
        );
        
        if (userEmployee?.employeeId) {
          snapshot = await getDocs(query(collection(db, 'payrolls'), where('employeeId', '==', userEmployee.employeeId)));
        } else {
          snapshot = await getDocs(query(collection(db, 'payrolls'), where('employeeId', '==', '')));
        }
      }

      const payrollsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PayrollRecord[];

      setPayrolls(payrollsData.sort((a, b) => {
        const dateA = new Date(`${a.year}-${a.month}-01`);
        const dateB = new Date(`${b.year}-${b.month}-01`);
        return dateB.getTime() - dateA.getTime();
      }));
    } catch (error) {
      console.error('Error fetching payrolls:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPayrolls = () => {
    let filtered = [...payrolls];

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (monthFilter !== 'all') {
      filtered = filtered.filter(p => p.month.toLowerCase() === monthFilter.toLowerCase());
    }

    if (yearFilter !== 'all') {
      filtered = filtered.filter(p => p.year === yearFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    setFilteredPayrolls(filtered);
  };

  const calculatePayroll = (data: PayrollRecord): PayrollRecord => {
    const settings = payrollSettings;
    if (!settings) return data;

    const baseSalary = data.baseSalary || parseFloat(settings.baseSalary.toString());
    const overtimeHours = data.overtimeHours || 0;
    const overtimeRate = parseFloat(settings.overtimeRate.toString());
    const overtimeAmount = overtimeHours * overtimeRate;
    const bonus = data.bonus || 0;
    const deductions = data.deductions || 0;
    const taxRate = parseFloat(settings.taxRate.toString()) / 100;
    
    const grossSalary = baseSalary + overtimeAmount + bonus;
    const tax = grossSalary * taxRate;
    const netSalary = grossSalary - tax - deductions;

    return {
      ...data,
      baseSalary,
      overtimeAmount: Math.round(overtimeAmount * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      grossSalary: Math.round(grossSalary * 100) / 100,
      netSalary: Math.round(netSalary * 100) / 100
    };
  };

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find(emp => emp.employeeId === employeeId);
    if (employee) {
      const baseSalary = employee.salary ? parseFloat(employee.salary.toString()) : (payrollSettings?.baseSalary || 0);
      setFormData(prev => ({
        ...prev,
        employeeId,
        employeeName: employee.name || employee.fullName || '',
        baseSalary
      }));
    }
  };

  const handleFormChange = (field: keyof PayrollRecord, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      return calculatePayroll(updated);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const calculatedData = calculatePayroll(formData);
      
      if (editingPayroll?.id) {
        await updateDoc(doc(db, 'payrolls', editingPayroll.id), {
          ...calculatedData,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'payrolls'), {
          ...calculatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      await fetchPayrolls(currentUserId, userRole);
      setShowForm(false);
      setEditingPayroll(null);
      resetForm();
    } catch (error) {
      console.error('Error saving payroll:', error);
      alert('Error saving payroll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (payroll: PayrollRecord) => {
    setEditingPayroll(payroll);
    setFormData(payroll);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payroll record?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'payrolls', id));
      await fetchPayrolls(currentUserId, userRole);
    } catch (error) {
      console.error('Error deleting payroll:', error);
      alert('Error deleting payroll. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      employeeName: '',
      month: new Date().toLocaleString('default', { month: 'long' }),
      year: new Date().getFullYear().toString(),
      baseSalary: payrollSettings?.baseSalary || 0,
      overtimeHours: 0,
      overtimeAmount: 0,
      bonus: 0,
      deductions: 0,
      tax: 0,
      grossSalary: 0,
      netSalary: 0,
      status: 'pending',
      notes: ''
    });
    setEditingPayroll(null);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Process each row
          const payrollsToAdd: Omit<PayrollRecord, 'id'>[] = [];
          
          for (const row of jsonData as any[]) {
            const employeeId = row['Employee ID'] || row['EmployeeID'] || row['employeeId'] || '';
            const employee = employees.find(emp => emp.employeeId === employeeId);
            
            if (!employee) {
              console.warn(`Employee not found: ${employeeId}`);
              continue;
            }

            const baseSalary = parseFloat(row['Base Salary'] || row['baseSalary'] || employee.salary || payrollSettings?.baseSalary || 0);
            const overtimeHours = parseFloat(row['Overtime Hours'] || row['overtimeHours'] || 0);
            const bonus = parseFloat(row['Bonus'] || row['bonus'] || 0);
            const deductions = parseFloat(row['Deductions'] || row['deductions'] || 0);
            const month = row['Month'] || row['month'] || new Date().toLocaleString('default', { month: 'long' });
            const year = row['Year'] || row['year'] || new Date().getFullYear().toString();
            const status = row['Status'] || row['status'] || 'pending';
            const notes = row['Notes'] || row['notes'] || '';

            const payrollData: Omit<PayrollRecord, 'id'> = {
              employeeId,
              employeeName: employee.name || employee.fullName || '',
              month,
              year,
              baseSalary,
              overtimeHours,
              overtimeAmount: 0,
              bonus,
              deductions,
              tax: 0,
              grossSalary: 0,
              netSalary: 0,
              status,
              notes,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            const calculated = calculatePayroll(payrollData);
            payrollsToAdd.push(calculated);
          }

          // Add all payrolls to Firestore
          for (const payroll of payrollsToAdd) {
            await addDoc(collection(db, 'payrolls'), payroll);
          }

          alert(`Successfully imported ${payrollsToAdd.length} payroll records!`);
          await fetchPayrolls(currentUserId, userRole);
          e.target.value = ''; // Reset file input
        } catch (error) {
          console.error('Error processing Excel file:', error);
          alert('Error processing Excel file. Please check the format and try again.');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file. Please try again.');
      setUploading(false);
    }
  };

  const handleExport = () => {
    const exportData = filteredPayrolls.map(p => ({
      'Employee ID': p.employeeId,
      'Employee Name': p.employeeName,
      'Month': p.month,
      'Year': p.year,
      'Base Salary': p.baseSalary,
      'Overtime Hours': p.overtimeHours,
      'Overtime Amount': p.overtimeAmount,
      'Bonus': p.bonus,
      'Deductions': p.deductions,
      'Tax': p.tax,
      'Gross Salary': p.grossSalary,
      'Net Salary': p.netSalary,
      'Status': p.status,
      'Notes': p.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payrolls');
    XLSX.writeFile(wb, `Payroll_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => y.toString());

  if (loading && payrolls.length === 0) {
    return (
      <div className="full-page">
        <div className="staff-management payroll-management">
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Loading payrolls...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-page">
      <div className="staff-management payroll-management">
      <div className="management-header-section">
        <h2 style={{ marginBottom: '24px', color: '#1f2937', fontSize: '1.75rem', fontWeight: '600' }}>
          Payroll Management
        </h2>
        <div className="management-header">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search by Employee ID or Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <select
            className="filter-select"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="all">All Months</option>
            {months.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="all">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
          <div className="action-buttons">
            <button className="btn-export" onClick={handleExport}>
              <Icon name="export" />
              Export Excel
            </button>
            <label className="btn-upload" style={{ cursor: 'pointer' }}>
              <Icon name="upload" />
              {uploading ? 'Uploading...' : 'Upload Excel'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>
            {(isAdminUser) && (
              <button className="btn-new-record" onClick={() => { setShowForm(true); resetForm(); }}>
                <Icon name="plus" />
                New Payroll
              </button>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="payroll-form-modal">
          <div className="payroll-form-content">
            <div className="form-header">
              <h3>{editingPayroll ? 'Edit Payroll' : 'Create New Payroll'}</h3>
              <button className="close-btn" onClick={() => { setShowForm(false); resetForm(); }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Employee *</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                    required
                    disabled={!!editingPayroll}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.employeeId}>
                        {emp.employeeId} - {emp.name || emp.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Month *</label>
                  <select
                    value={formData.month}
                    onChange={(e) => handleFormChange('month', e.target.value)}
                    required
                  >
                    {months.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Year *</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => handleFormChange('year', e.target.value)}
                    required
                    min="2020"
                    max="2100"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Base Salary *</label>
                  <input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) => handleFormChange('baseSalary', parseFloat(e.target.value) || 0)}
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Overtime Hours</label>
                  <input
                    type="number"
                    value={formData.overtimeHours}
                    onChange={(e) => handleFormChange('overtimeHours', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.5"
                  />
                </div>
                <div className="form-group">
                  <label>Overtime Amount (Auto-calculated)</label>
                  <input
                    type="number"
                    value={formData.overtimeAmount.toFixed(2)}
                    readOnly
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Bonus</label>
                  <input
                    type="number"
                    value={formData.bonus}
                    onChange={(e) => handleFormChange('bonus', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Deductions</label>
                  <input
                    type="number"
                    value={formData.deductions}
                    onChange={(e) => handleFormChange('deductions', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Tax (Auto-calculated)</label>
                  <input
                    type="number"
                    value={formData.tax.toFixed(2)}
                    readOnly
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Gross Salary (Auto-calculated)</label>
                  <input
                    type="number"
                    value={formData.grossSalary.toFixed(2)}
                    readOnly
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="form-group">
                  <label>Net Salary (Auto-calculated)</label>
                  <input
                    type="number"
                    value={formData.netSalary.toFixed(2)}
                    readOnly
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed', fontWeight: 'bold', color: '#059669' }}
                  />
                </div>
                <div className="form-group">
                  <label>Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value as any)}
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  rows={3}
                  placeholder="Additional notes or comments..."
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : editingPayroll ? 'Update Payroll' : 'Create Payroll'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="staff-table-container">
        <table className="staff-table payroll-excel-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Month</th>
              <th>Year</th>
              <th>Base Salary</th>
              <th>Overtime Hours</th>
              <th>Bonus</th>
              <th>Deductions</th>
              <th>Status</th>
              <th>Notes</th>
              {(isAdminUser) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredPayrolls.length === 0 ? (
              <tr>
                <td colSpan={isAdminUser ? 10 : 9} className="no-data">
                  No payroll records found
                </td>
              </tr>
            ) : (
              filteredPayrolls.map((payroll) => (
                <tr key={payroll.id}>
                  <td>{payroll.employeeId}</td>
                  <td>{payroll.month}</td>
                  <td>{payroll.year}</td>
                  <td>{formatCurrency(payroll.baseSalary)}</td>
                  <td>{payroll.overtimeHours}</td>
                  <td>{formatCurrency(payroll.bonus)}</td>
                  <td>{formatCurrency(payroll.deductions)}</td>
                  <td>
                    <span className={`status-badge ${payroll.status}`}>
                      {payroll.status}
                    </span>
                  </td>
                  <td>{payroll.notes || '-'}</td>
                  {(isAdminUser) && (
                    <td>
                      <div className="action-icons">
                        <button
                          className="action-icon edit"
                          title="Edit"
                          onClick={() => handleEdit(payroll)}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="action-icon delete"
                          title="Delete"
                          onClick={() => handleDelete(payroll.id!)}
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </td>
                  )}
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

export default PayrollManagement;

