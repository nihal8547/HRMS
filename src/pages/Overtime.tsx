import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, doc, getDoc, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { fetchUserRole, isAdmin } from '../utils/userRole';
import { fetchAllEmployees } from '../utils/fetchEmployees';
import { usePagePermissions } from '../hooks/usePagePermissions';
import Icon from '../components/Icons';
import Loading from '../components/Loading';
import jsPDF from 'jspdf';
// Import autoTable as a function (v5+ API)
// jspdf-autotable v5 exports autoTable as a named export
import { autoTable } from 'jspdf-autotable';
import './Staffs/StaffCreate.css';
import './Staffs/StaffManagement.css';
import './Overtime.css';

interface OvertimeEntry {
  date: string;
  fromTime: string;
  toTime: string;
  hours: number;
  reason: string;
}

interface SubmittedOvertime {
  id: string;
  employeeId: string;
  name: string;
  date: string;
  fromTime: string;
  toTime: string;
  hours: number;
  reason: string;
  status: string;
  createdAt: any;
  submittedAt: any;
  isReset?: boolean;
  resetMonth?: string;
  resetAt?: any;
}

const Overtime = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [entries, setEntries] = useState<OvertimeEntry[]>([
    { date: '', fromTime: '', toTime: '', hours: 0, reason: '' }
  ]);
  const [staffs, setStaffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [_userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [showPastOvertimeModal, setShowPastOvertimeModal] = useState(false);
  const [submittedOvertimes, setSubmittedOvertimes] = useState<SubmittedOvertime[]>([]);
  const [pastOvertimes, setPastOvertimes] = useState<SubmittedOvertime[]>([]);
  const [loadingSubmitted, setLoadingSubmitted] = useState(false);
  const [loadingPastOvertimes, setLoadingPastOvertimes] = useState(false);
  const [showNewOvertimeModal, setShowNewOvertimeModal] = useState(false);
  const [editingOvertime, setEditingOvertime] = useState<SubmittedOvertime | null>(null);
  const [singleEntry, setSingleEntry] = useState<OvertimeEntry & { employeeId: string; employeeName: string }>({
    employeeId: '',
    employeeName: '',
    date: '',
    fromTime: '',
    toTime: '',
    hours: 0,
    reason: ''
  });
  const [modalEntries, setModalEntries] = useState<OvertimeEntry[]>([
    { date: '', fromTime: '', toTime: '', hours: 0, reason: '' }
  ]);

  const { canEditDelete, canSubmit, canView } = usePagePermissions('Overtime');

  const fetchSubmittedOvertimes = useCallback(async () => {
    try {
      setLoadingSubmitted(true);
      let overtimeSnapshot;

      if (isAdminUser) {
        // Admin can see all overtime records
        overtimeSnapshot = await getDocs(collection(db, 'overtime'));
      } else {
        // Non-admin users can only see their own records
        const employees = await fetchAllEmployees();
        const currentUser = auth.currentUser;
        const userEmployee = employees.find(emp => 
          emp.id === currentUser?.uid || emp.authUserId === currentUser?.uid
        );
        
        if (userEmployee?.employeeId) {
          // Filter by employeeId
          overtimeSnapshot = await getDocs(query(collection(db, 'overtime'), where('employeeId', '==', userEmployee.employeeId)));
        } else if (currentUser?.uid) {
          // Fallback: filter by userId
          overtimeSnapshot = await getDocs(query(collection(db, 'overtime'), where('userId', '==', currentUser.uid)));
        } else {
          // No user found, return empty
          overtimeSnapshot = { docs: [] } as any;
        }
      }

      const records = overtimeSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as SubmittedOvertime[];

      // Filter to show only non-reset records (isReset !== true or undefined)
      const nonResetRecords = records.filter(record => !record.isReset);

      // Sort by date (newest first)
      nonResetRecords.sort((a, b) => {
        const dateA = a.submittedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.submittedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setSubmittedOvertimes(nonResetRecords);
    } catch (error) {
      console.error('Error fetching submitted overtimes:', error);
    } finally {
      setLoadingSubmitted(false);
    }
  }, [isAdminUser]);

  const fetchPastOvertimes = useCallback(async () => {
    try {
      setLoadingPastOvertimes(true);
      let overtimeSnapshot;

      if (isAdminUser) {
        // Admin can see all reset overtime records
        overtimeSnapshot = await getDocs(collection(db, 'overtime'));
      } else {
        // Non-admin users can only see their own records
        const employees = await fetchAllEmployees();
        const currentUser = auth.currentUser;
        const userEmployee = employees.find(emp => 
          emp.id === currentUser?.uid || emp.authUserId === currentUser?.uid
        );
        
        if (userEmployee?.employeeId) {
          // Filter by employeeId
          overtimeSnapshot = await getDocs(query(collection(db, 'overtime'), where('employeeId', '==', userEmployee.employeeId)));
        } else if (currentUser?.uid) {
          // Fallback: filter by userId
          overtimeSnapshot = await getDocs(query(collection(db, 'overtime'), where('userId', '==', currentUser.uid)));
        } else {
          overtimeSnapshot = { docs: [] } as any;
        }
      }

      const records = overtimeSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as SubmittedOvertime[];

      // Filter to show only reset records (isReset === true)
      const resetRecords = records.filter(record => record.isReset === true);

      // Sort by resetMonth and date (newest first)
      resetRecords.sort((a, b) => {
        // First sort by resetMonth (newest first)
        const monthA = a.resetMonth || '';
        const monthB = b.resetMonth || '';
        if (monthA !== monthB) {
          return monthB.localeCompare(monthA);
        }
        // Then sort by date
        const dateA = a.submittedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.submittedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setPastOvertimes(resetRecords);
    } catch (error) {
      // Error handled silently - user will see empty state
    } finally {
      setLoadingPastOvertimes(false);
    }
  }, [isAdminUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        const adminStatus = isAdmin(role);
        setUserRole(role);
        setIsAdminUser(adminStatus);
        await fetchCurrentUserData(user.uid, adminStatus);
        await fetchStaffs();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUserId && (isAdminUser || currentUserData)) {
      fetchSubmittedOvertimes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, isAdminUser, currentUserData]);

  const handleViewPastOvertime = async () => {
    setShowPastOvertimeModal(true);
    await fetchPastOvertimes();
  };

  const fetchCurrentUserData = async (uid: string, isAdmin: boolean) => {
    try {
      // Try to fetch from employees collection
      const employeeDoc = await getDoc(doc(db, 'employees', uid));
      if (employeeDoc.exists()) {
        const data = employeeDoc.data();
        const userData = {
          employeeId: data.employeeId || '',
          name: data.fullName || data.name || ''
        };
        setCurrentUserData(userData);
        // Auto-populate form for non-admin users
        if (!isAdmin) {
          setEmployeeId(userData.employeeId);
          setEmployeeName(userData.name);
        }
        return;
      }

      // Try staffs collection by authUserId
      const staffQuery = query(collection(db, 'staffs'), where('authUserId', '==', uid));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        const data = staffSnapshot.docs[0].data();
        const userData = {
          employeeId: data.employeeId || '',
          name: data.name || data.fullName || ''
        };
        setCurrentUserData(userData);
        // Auto-populate form for non-admin users
        if (!isAdmin) {
          setEmployeeId(userData.employeeId);
          setEmployeeName(userData.name);
        }
      }
    } catch (error) {
      // Error handled - continue with default values
    }
  };

  const fetchStaffs = async () => {
    try {
      const employees = await fetchAllEmployees();
      setStaffs(employees);
    } catch (error) {
      console.error('Error fetching staffs:', error);
    }
  };

  // Format date to dd/MM/yyyy
  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const calculateHours = (fromTime: string, toTime: string): number => {
    if (!fromTime || !toTime) return 0;
    
    const [fromHours, fromMinutes] = fromTime.split(':').map(Number);
    const [toHours, toMinutes] = toTime.split(':').map(Number);
    
    const fromTotalMinutes = fromHours * 60 + fromMinutes;
    const toTotalMinutes = toHours * 60 + toMinutes;
    
    // Handle case where toTime is next day (e.g., 22:00 to 02:00)
    let diffMinutes = toTotalMinutes - fromTotalMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Add 24 hours
    }
    
    // Custom conversion: 30 minutes = 0.30 hours (instead of 0.50)
    // Formula: hours = (full hours) + (minutes * 0.01)
    const fullHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    const hours = fullHours + (remainingMinutes * 0.01);
    
    // Round to 2 decimal places
    return Math.round(hours * 100) / 100;
  };

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedEmployeeId = e.target.value;
    setEmployeeId(selectedEmployeeId);
    const selectedEmployee = staffs.find(s => s.employeeId === selectedEmployeeId);
    setEmployeeName(selectedEmployee?.name || selectedEmployee?.fullName || '');
  };

  const handleEntryChange = (index: number, field: keyof OvertimeEntry, value: string) => {
    const updatedEntries = [...entries];
    updatedEntries[index] = {
      ...updatedEntries[index],
      [field]: value
    };

    // Auto-calculate hours when fromTime or toTime changes
    if (field === 'fromTime' || field === 'toTime') {
      updatedEntries[index].hours = calculateHours(
        field === 'fromTime' ? value : updatedEntries[index].fromTime,
        field === 'toTime' ? value : updatedEntries[index].toTime
      );
    }

    setEntries(updatedEntries);
  };

  const addEntry = () => {
    setEntries([...entries, { date: '', fromTime: '', toTime: '', hours: 0, reason: '' }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validate
    if (!employeeId || !employeeName) {
      setMessage('Please select an employee');
      setLoading(false);
      return;
    }

    const validEntries = entries.filter(entry => 
      entry.date && entry.fromTime && entry.toTime && entry.reason.trim()
    );

    if (validEntries.length === 0) {
      setMessage('Please add at least one valid overtime entry');
      setLoading(false);
      return;
    }

    try {
      // Submit each entry as a separate document
      const submissionPromises = validEntries.map(entry =>
        addDoc(collection(db, 'overtime'), {
          employeeId,
          name: employeeName,
          date: entry.date,
          fromTime: entry.fromTime,
          toTime: entry.toTime,
          hours: entry.hours,
          reason: entry.reason,
          status: 'pending',
          isReset: false, // New records are not reset
          createdAt: new Date(),
          submittedAt: new Date()
        })
      );

      await Promise.all(submissionPromises);
      setMessage(`Successfully submitted ${validEntries.length} overtime ${validEntries.length === 1 ? 'entry' : 'entries'}!`);
      
      // Refresh submitted overtimes table
      await fetchSubmittedOvertimes();
      
      // Reset form
      if (isAdminUser) {
        setEmployeeId('');
        setEmployeeName('');
        setEntries([{ date: '', fromTime: '', toTime: '', hours: 0, reason: '' }]);
      } else {
        setEntries([{ date: '', fromTime: '', toTime: '', hours: 0, reason: '' }]);
      }
    } catch (error) {
      console.error('Error submitting overtime:', error);
      setMessage('Error submitting overtime. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openNewOvertimeModal = () => {
    setEditingOvertime(null);
    // For non-admin users, always use their own employee data
    const baseEmployeeId = isAdminUser ? '' : (currentUserData?.employeeId || employeeId || '');
    const baseEmployeeName = isAdminUser ? '' : (currentUserData?.name || employeeName || '');
    setSingleEntry({
      employeeId: baseEmployeeId,
      employeeName: baseEmployeeName,
      date: '',
      fromTime: '',
      toTime: '',
      hours: 0,
      reason: ''
    });
    setModalEntries([{ date: '', fromTime: '', toTime: '', hours: 0, reason: '' }]);
    setShowNewOvertimeModal(true);
  };

  const handleSingleEntryChange = (field: keyof OvertimeEntry | 'employeeId' | 'employeeName', value: string) => {
    setSingleEntry((prev) => {
      const updated: any = { ...prev, [field]: value };

      // Auto-fill name when admin selects employee
      if (field === 'employeeId') {
        const selected = staffs.find((s) => s.employeeId === value);
        if (selected) {
          updated.employeeName = selected.name || selected.fullName || '';
        }
      }

      if (field === 'fromTime' || field === 'toTime') {
        updated.hours = calculateHours(
          field === 'fromTime' ? value : updated.fromTime,
          field === 'toTime' ? value : updated.toTime
        );
      }
      return updated;
    });
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const targetEmployeeId = singleEntry.employeeId || employeeId;
    const targetEmployeeName = singleEntry.employeeName || employeeName;

    if (!targetEmployeeId || !targetEmployeeName) {
      setMessage('Please select an employee');
      setLoading(false);
      return;
    }

    if (editingOvertime) {
      // Only allow editing for users with full access (admins)
      if (!canEditDelete) {
        setMessage('Error: You do not have permission to edit overtime records.');
        setLoading(false);
        return;
      }
      
      if (!singleEntry.date || !singleEntry.fromTime || !singleEntry.toTime || !singleEntry.reason.trim()) {
        setMessage('Please fill all required fields');
        setLoading(false);
        return;
      }

      try {
        // Update existing record
        await updateDoc(doc(db, 'overtime', editingOvertime.id), {
          employeeId: targetEmployeeId,
          name: targetEmployeeName,
          date: singleEntry.date,
          fromTime: singleEntry.fromTime,
          toTime: singleEntry.toTime,
          hours: singleEntry.hours,
          reason: singleEntry.reason,
          updatedAt: new Date()
        });
        setMessage('Overtime entry updated successfully!');
        setEditingOvertime(null);
        setShowNewOvertimeModal(false);
        await fetchSubmittedOvertimes();
      } catch (error) {
        console.error('Error updating overtime:', error);
        setMessage('Error updating overtime. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // For new entries, validate all modal entries
    const validEntries = modalEntries.filter(entry => 
      entry.date && entry.fromTime && entry.toTime && entry.reason.trim()
    );

    if (validEntries.length === 0) {
      setMessage('Please add at least one valid overtime entry');
      setLoading(false);
      return;
    }

    try {
      // Submit each entry as a separate document
      const currentUser = auth.currentUser;
      const submissionPromises = validEntries.map(entry =>
        addDoc(collection(db, 'overtime'), {
          userId: currentUser?.uid || '',
          employeeId: targetEmployeeId,
          name: targetEmployeeName,
          date: entry.date,
          fromTime: entry.fromTime,
          toTime: entry.toTime,
          hours: entry.hours,
          reason: entry.reason,
          status: 'pending',
          isReset: false, // New records are not reset
          createdAt: new Date(),
          submittedAt: new Date()
        })
      );

      await Promise.all(submissionPromises);
      setMessage(`Successfully submitted ${validEntries.length} overtime ${validEntries.length === 1 ? 'entry' : 'entries'}!`);
      setShowNewOvertimeModal(false);
      setModalEntries([{ date: '', fromTime: '', toTime: '', hours: 0, reason: '' }]); // Reset modal entries
      await fetchSubmittedOvertimes();
    } catch (error) {
      console.error('Error submitting overtime:', error);
      setMessage('Error submitting overtime. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (overtime: SubmittedOvertime) => {
    // Only allow edit for users with full access (admins)
    if (!canEditDelete) {
      alert('You do not have permission to edit overtime records.');
      return;
    }

    setEditingOvertime(overtime);
    setSingleEntry({
      employeeId: overtime.employeeId,
      employeeName: overtime.name,
      date: overtime.date,
      fromTime: overtime.fromTime,
      toTime: overtime.toTime,
      hours: overtime.hours,
      reason: overtime.reason
    });
    // Reset modal entries when editing (edit uses single entry form)
    setModalEntries([{ date: '', fromTime: '', toTime: '', hours: 0, reason: '' }]);
    setShowNewOvertimeModal(true);
  };

  const handleDelete = async (id: string) => {
    // Only allow delete for users with full access (admins)
    if (!canEditDelete) {
      alert('You do not have permission to delete overtime records.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this overtime record?')) {
      try {
        await deleteDoc(doc(db, 'overtime', id));
        setMessage('Overtime record deleted successfully!');
        await fetchSubmittedOvertimes();
      } catch (error) {
        console.error('Error deleting overtime:', error);
        alert('Error deleting overtime record. Please try again.');
      }
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    if (!isAdminUser) {
      alert('Only administrators can update overtime status.');
      return;
    }

    try {
      await updateDoc(doc(db, 'overtime', id), {
        status: newStatus,
        updatedAt: new Date()
      });
      setMessage('Overtime status updated successfully!');
      await fetchSubmittedOvertimes();
    } catch (error) {
      console.error('Error updating overtime status:', error);
      setMessage('Error updating overtime status. Please try again.');
    }
  };

  const handleClearAllData = async () => {
    if (!isAdminUser) {
      alert('Only administrators can clear overtime data.');
      return;
    }

    if (submittedOvertimes.length === 0) {
      alert('No overtime records to clear.');
      return;
    }

    const confirmMessage = `Are you sure you want to clear all ${submittedOvertimes.length} overtime record(s)?\n\nThis will move all current records to the Past Overtime section.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      const now = new Date();
      const resetMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); // e.g., "January 2024"
      
      // Update all current records to mark them as reset
      const updatePromises = submittedOvertimes.map(record => 
        updateDoc(doc(db, 'overtime', record.id!), {
          isReset: true,
          resetMonth: resetMonth,
          resetAt: now
        })
      );

      await Promise.all(updatePromises);
      
      setMessage(`Successfully cleared ${submittedOvertimes.length} overtime record(s). They are now available in Past Overtime section.`);
      await fetchSubmittedOvertimes();
      await fetchPastOvertimes();
    } catch (error) {
      console.error('Error clearing overtime data:', error);
      setMessage('Error clearing overtime data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addModalEntry = () => {
    setModalEntries([...modalEntries, { date: '', fromTime: '', toTime: '', hours: 0, reason: '' }]);
  };

  const removeModalEntry = (index: number) => {
    if (modalEntries.length > 1) {
      setModalEntries(modalEntries.filter((_, i) => i !== index));
    }
  };

  const handleModalEntryChange = (index: number, field: keyof OvertimeEntry, value: string) => {
    const updated = [...modalEntries];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate hours when fromTime or toTime changes
    if (field === 'fromTime' || field === 'toTime') {
      updated[index].hours = calculateHours(
        field === 'fromTime' ? value : updated[index].fromTime,
        field === 'toTime' ? value : updated[index].toTime
      );
    }
    
    setModalEntries(updated);
  };

  const loadLogoAsBase64 = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Try to load logo from public folder
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL('image/png');
          resolve(base64);
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };
      
      img.onerror = () => {
        // If logo not found, use a placeholder or create a text-based logo
        resolve('');
      };
      
      // Try to load logo from public folder
      img.src = '/logo.png';
    });
  };

  /**
   * Professional Overtime PDF Export Function
   * Generates a clean, professional A4 PDF document for overtime reports
   * 
   * @param records - Array of overtime records to include in the PDF
   * @param employeeData - Employee information (name, employeeId, department)
   * @param monthYear - Month and year for the report (e.g., "January 2024")
   * @param fileName - Optional custom file name, otherwise auto-generated
   */
  const exportOvertimeToPDF = async (
    records: SubmittedOvertime[],
    employeeData: { name: string; employeeId: string; department?: string },
    monthYear?: string,
    fileName?: string
  ): Promise<void> => {
    try {
      // Validate inputs
      if (!records || records.length === 0) {
        throw new Error('No overtime records to export');
      }

      if (!employeeData || !employeeData.name || !employeeData.employeeId) {
        throw new Error('Employee data is required');
      }

      // Initialize PDF document (A4 size, portrait orientation)
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm for A4
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm for A4
      const margin = 15; // 15mm margins on all sides
      let yPos = margin; // Start position

      // ============================================
      // SECTION 1: HEADER WITH LOGO AND TITLE
      // ============================================
      
      // Try to load and add company logo (top-right)
      try {
        const logoBase64 = await loadLogoAsBase64();
        if (logoBase64) {
          // Logo positioned at top-right, fixed size: 40mm width, auto height
          const logoWidth = 40;
          const logoHeight = 15;
          const logoX = pageWidth - margin - logoWidth; // Right-aligned with margin
          const logoY = margin;
          doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
        }
      } catch (error) {
        console.log('Logo not found, continuing without logo');
      }

      // "OVERTIME REPORT" heading (left side, bold)
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0); // Black
      doc.text('OVERTIME REPORT', margin, yPos + 12);

      // Move down after header
      yPos = 35;

      // ============================================
      // SECTION 2: EMPLOYEE DETAILS (TWO COLUMNS)
      // ============================================
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60); // Dark gray

      // Left column (starting at margin)
      const leftColX = margin;
      const rightColX = pageWidth / 2 + 10; // Start of right column
      const lineHeight = 7; // Space between lines

      // Employee Name
      doc.setFont('helvetica', 'bold');
      doc.text('Employee Name:', leftColX, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(employeeData.name || 'N/A', leftColX + 35, yPos);

      // Employee Code / ID
      yPos += lineHeight;
      doc.setFont('helvetica', 'bold');
      doc.text('Employee Code:', leftColX, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(employeeData.employeeId || 'N/A', leftColX + 35, yPos);

      // Department (right column)
      yPos = 35; // Reset to top for right column
      doc.setFont('helvetica', 'bold');
      doc.text('Department:', rightColX, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(employeeData.department || 'N/A', rightColX + 30, yPos);

      // Month & Year of Overtime (right column, second line)
      yPos += lineHeight;
      doc.setFont('helvetica', 'bold');
      doc.text('Month & Year:', rightColX, yPos);
      doc.setFont('helvetica', 'normal');
      
      // Determine month/year from records or use provided value
      let reportMonthYear = monthYear || '';
      if (!reportMonthYear && records.length > 0) {
        const firstDate = records[0].date;
        if (firstDate) {
          const dateParts = firstDate.split('-');
          if (dateParts.length === 3) {
            const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
            if (!isNaN(date.getTime())) {
              reportMonthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            }
          }
        }
      }
      if (!reportMonthYear) {
        reportMonthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      doc.text(reportMonthYear, rightColX + 30, yPos);

      // Move down after employee details
      yPos = 55;

      // ============================================
      // SECTION 3: OVERTIME DETAILS TABLE
      // ============================================
      
      // Prepare table data
      const tableData = records.map((record, index) => {
        // Format date to dd/MM/yyyy
        let formattedDate = 'N/A';
        if (record.date) {
          const dateParts = record.date.split('-');
          if (dateParts.length === 3) {
            formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
          } else {
            formattedDate = record.date;
          }
        }

        // Format status (capitalize first letter)
        const status = record.status || 'pending';
        const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);

        return [
          (index + 1).toString(), // Sl. No
          formattedDate, // Date
          record.fromTime || 'N/A', // From Time
          record.toTime || 'N/A', // To Time
          (record.hours || 0).toFixed(2), // Total Hours
          record.reason || 'N/A', // Reason (will auto-wrap)
          formattedStatus // Status
        ];
      });

      // Table columns
      const tableColumns = [
        'Sl. No',
        'Date',
        'From Time',
        'To Time',
        'Total Hours',
        'Reason',
        'Status'
      ];

      // Calculate total hours
      const totalHours = records.reduce((sum, record) => sum + (record.hours || 0), 0);

      // Add table using autoTable (v5+ API - function call, not prototype method)
      if (!autoTable || typeof autoTable !== 'function') {
        throw new Error('autoTable function is not available. Please ensure jspdf-autotable is properly installed.');
      }

      autoTable(doc, {
        head: [tableColumns],
        body: tableData,
        startY: yPos,
        margin: { left: margin, right: margin, top: 5, bottom: 5 },
        styles: {
          fontSize: 9,
          cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
          textColor: [0, 0, 0],
          font: 'helvetica',
          fontStyle: 'normal',
          lineColor: [0, 0, 0], // Black borders
          lineWidth: 0.1, // Standard border width
          fillColor: [255, 255, 255], // White background
          halign: 'left',
          valign: 'middle'
        },
        headStyles: {
          fillColor: [41, 128, 185], // Blue header background
          textColor: [255, 255, 255], // White text
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
          lineColor: [0, 0, 0],
          lineWidth: 0.2 // Thicker borders for header
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15, cellPadding: { top: 5, bottom: 5, left: 3, right: 3 } }, // Sl. No
          1: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // Date
          2: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // From Time
          3: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // To Time
          4: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // Total Hours
          5: { halign: 'left', cellWidth: 'auto', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // Reason
          6: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } } // Status
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250], // Very light gray for alternate rows
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        bodyStyles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        // Wrap long text in Reason column
        didParseCell: (data: any) => {
          if (data.column.index === 5 && data.cell.text) {
            const text = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
            if (typeof text === 'string' && text.length > 30) {
              data.cell.text = (doc as any).splitTextToSize(text, 50);
            }
          }
        }
      });

      // Get the final Y position after table
      // In v5+, lastAutoTable is still available on the doc object
      const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
      yPos = finalY + 15; // Add spacing after table

      // Add total hours row below table
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Hours: ${totalHours.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 20;

      // ============================================
      // SECTION 4: SIGNATURE SECTION (BOTTOM)
      // ============================================
      
      // Ensure signatures are on the same page or add new page if needed
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = margin;
      }

      // Signature section Y position (near bottom with margin)
      const signatureY = pageHeight - 50;
      
      // Left side: Employee Signature
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      // Signature line
      doc.line(margin, signatureY, margin + 60, signatureY);
      doc.text('Employee Signature', margin, signatureY + 8);

      // Right side: Department Head Signature
      doc.line(pageWidth - margin - 60, signatureY, pageWidth - margin, signatureY);
      doc.text('Department Head Signature', pageWidth - margin - 60, signatureY + 8);

      // Date of PDF generation (centered at bottom)
      const now = new Date();
      let generatedDate = 'N/A';
      try {
        generatedDate = formatDate(now);
      } catch (error) {
        // Fallback date formatting
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        generatedDate = `${day}/${month}/${year}`;
      }
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'italic');
      doc.text(`Generated on: ${generatedDate}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

      // ============================================
      // SECTION 5: SAVE PDF FILE
      // ============================================
      
      // Generate file name if not provided
      if (!fileName) {
        const monthYearStr = reportMonthYear ? reportMonthYear.replace(/\s+/g, '-') : new Date().toISOString().split('T')[0];
        fileName = `Overtime_Report_${employeeData.employeeId || 'EMP'}_${monthYearStr}.pdf`;
      }

      // Save the PDF
      doc.save(fileName);
      
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      throw new Error(`Failed to generate PDF: ${errorMessage}`);
    }
  };

  const handleExportSingleRecord = async (record: SubmittedOvertime) => {
    try {
      setLoading(true);
      
      // Fetch employee department if available
      let department = '';
      try {
        const employees = await fetchAllEmployees();
        const employee = employees.find(emp => emp.employeeId === record.employeeId);
        department = employee?.department || '';
      } catch (error) {
        console.log('Could not fetch department');
      }

      // Use the professional PDF export function
      await exportOvertimeToPDF(
        [record],
        {
          name: record.name || 'N/A',
          employeeId: record.employeeId || 'N/A',
          department: department
        },
        undefined, // Let function determine month/year from record
        `Overtime_Report_${record.employeeId || 'Record'}_${record.date || new Date().toISOString().split('T')[0]}.pdf`
      );
      
      setLoading(false);
    } catch (error: any) {
      console.error('Error exporting overtime record:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Error exporting record: ${errorMessage}. Please check the console for more details.`);
      setLoading(false);
    }
  };

  /**
   * Export comprehensive overtime report for all employees
   * Creates a single PDF with overall summary and detailed employee sections
   */
  const exportAllEmployeesOvertimeReport = async (
    allRecords: SubmittedOvertime[],
    reportMonthYear?: string
  ): Promise<void> => {
    try {
      if (!allRecords || allRecords.length === 0) {
        throw new Error('No overtime records to export');
      }

      // Fetch all employees to get department information
      const employees = await fetchAllEmployees();

      // Group records by employee
      const groupedByEmployee = allRecords.reduce((acc, record) => {
        const key = record.employeeId || record.name || 'unknown';
        if (!acc[key]) {
          const emp = employees.find(e => e.employeeId === record.employeeId);
          acc[key] = {
            employeeId: record.employeeId || '',
            name: record.name || 'Unknown',
            department: emp?.department || '',
            records: []
          };
        }
        acc[key].records.push(record);
        return acc;
      }, {} as Record<string, { employeeId: string; name: string; department: string; records: SubmittedOvertime[] }>);

      const employeeGroups = Object.values(groupedByEmployee);

      // Determine report period
      let reportPeriod = reportMonthYear || '';
      if (!reportPeriod && allRecords.length > 0) {
        const firstDate = allRecords[0].date;
        if (firstDate) {
          const dateParts = firstDate.split('-');
          if (dateParts.length === 3) {
            const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
            reportPeriod = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          }
        }
      }
      if (!reportPeriod) {
        reportPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      // Initialize PDF document
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // ============================================
      // HEADER SECTION
      // ============================================
      
      // Company Logo (top-right)
      try {
        const logoBase64 = await loadLogoAsBase64();
        if (logoBase64) {
          const logoWidth = 40;
          const logoHeight = 15;
          const logoX = pageWidth - margin - logoWidth;
          doc.addImage(logoBase64, 'PNG', logoX, margin, logoWidth, logoHeight);
        }
      } catch (error) {
        console.log('Logo not found');
      }

      // Report Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('OVERTIME REQUEST REPORT - ALL EMPLOYEES', margin, yPos + 12);

      // Report Period
      yPos += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Period: ${reportPeriod}`, margin, yPos);

      yPos += 15;

      // ============================================
      // OVERALL SUMMARY SECTION
      // ============================================
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Overall Summary', margin, yPos);

      yPos += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const totalEmployees = employeeGroups.length;
      const totalRequests = allRecords.length;
      const totalHours = allRecords.reduce((sum, r) => sum + (r.hours || 0), 0);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Employees:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(totalEmployees.toString(), margin + 45, yPos);

      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Total Requests:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(totalRequests.toString(), margin + 45, yPos);

      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Total Hours:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`${totalHours.toFixed(2)} hours`, margin + 45, yPos);

      yPos += 15;

      // ============================================
      // EMPLOYEE DETAILS SECTIONS
      // ============================================
      
      employeeGroups.forEach((group, groupIndex) => {
        // Check if we need a new page
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = margin;
        }

        // Employee Header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(`${groupIndex + 1}. ${group.name.toUpperCase()} (${group.employeeId}) - ${group.department}`, margin, yPos);

        yPos += 8;

        // Employee Summary
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const empTotalRequests = group.records.length;
        const empTotalHours = group.records.reduce((sum, r) => sum + (r.hours || 0), 0);

        doc.setFont('helvetica', 'bold');
        doc.text('Total Requests:', margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(empTotalRequests.toString(), margin + 40, yPos);

        doc.setFont('helvetica', 'bold');
        doc.text('Total Hours:', margin + 80, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(empTotalHours.toFixed(2), margin + 120, yPos);

        yPos += 10;

        // Prepare table data for this employee
        const tableData = group.records.map((record, index) => {
          // Format date to dd/MM/yyyy
          let formattedDate = 'N/A';
          if (record.date) {
            const dateParts = record.date.split('-');
            if (dateParts.length === 3) {
              formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            } else {
              formattedDate = record.date;
            }
          }

          // Generate Ref Code (format: HHMMSS_index, e.g., "200000_1")
          // Based on the start time
          let refCode = `${index + 1}`;
          if (record.fromTime) {
            // Convert time to format: HHMMSS (e.g., "20:00:00" -> "200000")
            const timeStr = record.fromTime.replace(/:/g, '').padEnd(6, '0');
            refCode = `${timeStr}_${index + 1}`;
          } else if (record.id) {
            // Fallback: use first 6 chars of ID + index
            refCode = record.id.substring(0, 6) + '_' + (index + 1);
          }

          return [
            formattedDate, // Date
            refCode, // Ref Code
            record.fromTime || 'N/A', // Start Time
            record.toTime || 'N/A', // End Time
            (record.hours || 0).toFixed(2), // Hours
            record.reason || 'N/A' // Reason
          ];
        });

        // Add table for this employee with standard borders and spacing
        autoTable(doc, {
          head: [['Date', 'Ref Code', 'Start Time', 'End Time', 'Hours', 'Reason']],
          body: tableData,
          startY: yPos,
          margin: { left: margin, right: margin, top: 5, bottom: 5 },
          styles: {
            fontSize: 9,
            cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
            textColor: [0, 0, 0],
            font: 'helvetica',
            fontStyle: 'normal',
            lineColor: [0, 0, 0], // Black borders for all cells
            lineWidth: 0.1, // Standard border width
            fillColor: [255, 255, 255], // White background
            halign: 'left',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [41, 128, 185], // Blue header background
            textColor: [255, 255, 255], // White text
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'center',
            valign: 'middle',
            cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
            lineColor: [0, 0, 0],
            lineWidth: 0.2 // Thicker borders for header
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // Date
            1: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // Ref Code
            2: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // Start Time
            3: { halign: 'center', cellWidth: 25, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // End Time
            4: { halign: 'center', cellWidth: 20, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }, // Hours
            5: { halign: 'left', cellWidth: 'auto', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } } // Reason
          },
          alternateRowStyles: {
            fillColor: [250, 250, 250], // Very light gray for alternate rows
            lineColor: [0, 0, 0],
            lineWidth: 0.1
          },
          bodyStyles: {
            lineColor: [0, 0, 0],
            lineWidth: 0.1
          },
          didParseCell: (data: any) => {
            if (data.column.index === 5 && data.cell.text) {
              const text = Array.isArray(data.cell.text) ? data.cell.text[0] : data.cell.text;
              if (typeof text === 'string' && text.length > 30) {
                data.cell.text = (doc as any).splitTextToSize(text, 40);
              }
            }
          }
        });

        // Get final Y position after table
        const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
        yPos = finalY + 15; // Add spacing before next employee section
      });

      // ============================================
      // FOOTER
      // ============================================
      
      const now = new Date();
      let generatedDate = 'N/A';
      try {
        generatedDate = formatDate(now);
      } catch (error) {
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        generatedDate = `${day}/${month}/${year}`;
      }

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'italic');
      doc.text(`Generated on: ${generatedDate}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

      // Save PDF
      const fileName = `Overtime_Report_All_Employees_${reportPeriod.replace(/\s+/g, '-')}.pdf`;
      doc.save(fileName);

    } catch (error: any) {
      console.error('Error generating comprehensive PDF:', error);
      throw new Error(`Failed to generate PDF: ${error?.message || 'Unknown error'}`);
    }
  };

  /**
   * Export all submitted overtime records to PDF
   * Creates a comprehensive report with overall summary and employee details
   */
  const handleExportAllRecords = async () => {
    try {
      if (submittedOvertimes.length === 0) {
        alert('No records to export');
        return;
      }

      setLoading(true);

      // Determine report period from records
      let reportPeriod: string | undefined;
      if (submittedOvertimes.length > 0 && submittedOvertimes[0].date) {
        const dateParts = submittedOvertimes[0].date.split('-');
        if (dateParts.length === 3) {
          const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
          reportPeriod = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
      }

      // Export comprehensive report
      await exportAllEmployeesOvertimeReport(submittedOvertimes, reportPeriod);

      setLoading(false);
      alert('Overtime report exported successfully!');
    } catch (error: any) {
      console.error('Error exporting overtime records:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Error exporting records: ${errorMessage}. Please check the console for more details.`);
      setLoading(false);
    }
  };

  const handleExportCurrentTable = async () => {
    try {
      setLoading(true);
      
      // Use current table data (submittedOvertimes)
      const records = submittedOvertimes;
      
      if (records.length === 0) {
        alert('No records to export');
        setLoading(false);
        return;
      }

      // Get employee data from first record
      const employeeData = {
        employeeId: records[0].employeeId || '',
        name: records[0].name || ''
      };

      // Create PDF
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Try to load and add logo
      try {
        const logoBase64 = await loadLogoAsBase64();
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 20, yPos, 50, 15);
        }
      } catch (error) {
        console.log('Logo not found, continuing without logo');
      }

      // Company Header
      doc.setFontSize(20);
      doc.setTextColor(0, 102, 153); // Teal color
      doc.setFont('helvetica', 'bold');
      doc.text('FOCUS MEDICAL CENTRE', pageWidth / 2, yPos + 10, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 200); // Lighter teal
      doc.setFont('helvetica', 'normal');
      doc.text('فوكاس ميديكال سنتر', pageWidth / 2, yPos + 16, { align: 'center' });

      yPos = 40;

      // Report Title
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('OVERTIME REPORT', pageWidth / 2, yPos, { align: 'center' });

      yPos += 15;

      // Employee Information
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      if (employeeData) {
        doc.text(`Employee ID: ${employeeData.employeeId}`, 20, yPos);
        doc.text(`Employee Name: ${employeeData.name}`, 20, yPos + 7);
      }

      // Report Date
      const now = new Date();
      const reportDate = formatDate(now);
      doc.text(`Report Generated: ${reportDate}`, pageWidth - 20, yPos, { align: 'right' });

      yPos += 20;

      // Auto-generated content
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'italic');
      const autoText = 'This report contains all current overtime records. ' +
        'Each entry includes the date, time range, calculated hours, and reason for overtime work.';
      const splitText = doc.splitTextToSize(autoText, pageWidth - 40);
      doc.text(splitText, 20, yPos);
      
      yPos += splitText.length * 5 + 10;

      // Prepare table data
      const tableData = records.map(record => [
        record.date 
          ? (() => {
              const dateParts = record.date.split('-');
              if (dateParts.length === 3) {
                return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
              }
              return record.date;
            })()
          : 'N/A',
        record.fromTime || 'N/A',
        record.toTime || 'N/A',
        (record.hours || 0).toFixed(2),
        (record.reason || '').substring(0, 40) + ((record.reason || '').length > 40 ? '...' : ''),
        record.status || 'pending'
      ]);

      // Add table
      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'From Time', 'To Time', 'Hours', 'Reason', 'Status']],
        body: tableData,
        margin: { left: margin, right: margin, top: 5, bottom: 5 },
        styles: {
          fontSize: 9,
          cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
          textColor: [0, 0, 0],
          font: 'helvetica',
          fontStyle: 'normal',
          lineColor: [0, 0, 0], // Black borders
          lineWidth: 0.1, // Standard border width
          fillColor: [255, 255, 255], // White background
          halign: 'left',
          valign: 'middle'
        },
        headStyles: {
          fillColor: [41, 128, 185], // Blue header background
          textColor: [255, 255, 255], // White text
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
          lineColor: [0, 0, 0],
          lineWidth: 0.2 // Thicker borders for header
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250], // Very light gray for alternate rows
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          1: { cellWidth: 25, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          2: { cellWidth: 25, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          3: { cellWidth: 20, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          4: { cellWidth: 50, halign: 'left', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          5: { cellWidth: 25, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }
        }
      });

      // Get final Y position after table
      const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;

      // Summary section
      const totalHours = records.reduce((sum, record) => sum + (record.hours || 0), 0);
      const totalEntries = records.length;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Summary', 20, finalY + 15);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Entries: ${totalEntries}`, 20, finalY + 22);
      doc.text(`Total Hours: ${totalHours.toFixed(2)}`, 20, finalY + 29);

      // Footer
      const footerY = pageHeight - 20;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text('This is a computer-generated document. No signature required.', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Generated on ${formatDate(now)}`, pageWidth / 2, footerY + 5, { align: 'center' });

      // Save PDF
      const fileName = `Overtime_Report_${employeeData?.employeeId || 'Current'}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      setLoading(false);
    } catch (error) {
      console.error('Error exporting overtime report:', error);
      alert('Error exporting report. Please try again.');
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      
      // Fetch all overtime records for the current employee
      let overtimeSnapshot;
      let employeeData: { employeeId: string; name: string } | null = null;
      
      if (isAdminUser) {
        overtimeSnapshot = await getDocs(collection(db, 'overtime'));
      } else {
        const employees = await fetchAllEmployees();
        const userEmployee = employees.find(emp => 
          emp.id === currentUserId || emp.authUserId === currentUserId
        );
        
        if (userEmployee) {
          employeeData = {
            employeeId: userEmployee.employeeId || '',
            name: userEmployee.name || userEmployee.fullName || ''
          };
          overtimeSnapshot = await getDocs(query(collection(db, 'overtime'), where('employeeId', '==', employeeData.employeeId)));
        } else {
          overtimeSnapshot = await getDocs(query(collection(db, 'overtime'), where('employeeId', '==', '')));
        }
      }

      const records = overtimeSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as SubmittedOvertime[];

      // Get employee data from first record if not already set
      if (!employeeData && records.length > 0) {
        employeeData = {
          employeeId: records[0].employeeId || '',
          name: records[0].name || ''
        };
      }

      // Create PDF
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Try to load and add logo
      try {
        const logoBase64 = await loadLogoAsBase64();
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 20, yPos, 50, 15);
        }
      } catch (error) {
        console.log('Logo not found, continuing without logo');
      }

      // Company Header
      doc.setFontSize(20);
      doc.setTextColor(0, 102, 153); // Teal color
      doc.setFont('helvetica', 'bold');
      doc.text('FOCUS MEDICAL CENTRE', pageWidth / 2, yPos + 10, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 200); // Lighter teal
      doc.setFont('helvetica', 'normal');
      doc.text('فوكاس ميديكال سنتر', pageWidth / 2, yPos + 16, { align: 'center' });

      yPos = 40;

      // Report Title
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('OVERTIME REPORT', pageWidth / 2, yPos, { align: 'center' });

      yPos += 15;

      // Employee Information
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      if (employeeData) {
        doc.text(`Employee ID: ${employeeData.employeeId}`, 20, yPos);
        doc.text(`Employee Name: ${employeeData.name}`, 20, yPos + 7);
      }

      // Report Date
      const now = new Date();
      const reportDate = formatDate(now);
      doc.text(`Report Generated: ${reportDate}`, pageWidth - 20, yPos, { align: 'right' });

      yPos += 20;

      // Auto-generated content
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'italic');
      const autoText = 'This report contains all overtime records submitted by the employee. ' +
        'Each entry includes the date, time range, calculated hours, and reason for overtime work.';
      const splitText = doc.splitTextToSize(autoText, pageWidth - 40);
      doc.text(splitText, 20, yPos);
      
      yPos += splitText.length * 5 + 10;

      // Prepare table data
      const tableData = records.map(record => [
        record.date 
          ? (() => {
              const dateParts = record.date.split('-');
              if (dateParts.length === 3) {
                return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
              }
              return record.date;
            })()
          : 'N/A',
        record.fromTime || 'N/A',
        record.toTime || 'N/A',
        (record.hours || 0).toFixed(2),
        (record.reason || '').substring(0, 40) + ((record.reason || '').length > 40 ? '...' : ''),
        record.status || 'pending'
      ]);

      // Add table
      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'From Time', 'To Time', 'Hours', 'Reason', 'Status']],
        body: tableData,
        margin: { left: margin, right: margin, top: 5, bottom: 5 },
        styles: {
          fontSize: 9,
          cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
          textColor: [0, 0, 0],
          font: 'helvetica',
          fontStyle: 'normal',
          lineColor: [0, 0, 0], // Black borders
          lineWidth: 0.1, // Standard border width
          fillColor: [255, 255, 255], // White background
          halign: 'left',
          valign: 'middle'
        },
        headStyles: {
          fillColor: [41, 128, 185], // Blue header background
          textColor: [255, 255, 255], // White text
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
          lineColor: [0, 0, 0],
          lineWidth: 0.2 // Thicker borders for header
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250], // Very light gray for alternate rows
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          1: { cellWidth: 25, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          2: { cellWidth: 25, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          3: { cellWidth: 20, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          4: { cellWidth: 50, halign: 'left', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } },
          5: { cellWidth: 25, halign: 'center', cellPadding: { top: 5, bottom: 5, left: 4, right: 4 } }
        }
      });

      // Get final Y position after table
      const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;

      // Summary section
      const totalHours = records.reduce((sum, record) => sum + (record.hours || 0), 0);
      const totalEntries = records.length;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Summary', 20, finalY + 15);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Entries: ${totalEntries}`, 20, finalY + 22);
      doc.text(`Total Hours: ${totalHours.toFixed(2)}`, 20, finalY + 29);

      // Footer
      const footerY = pageHeight - 20;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text('This is a computer-generated document. No signature required.', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Generated on ${formatDate(now)}`, pageWidth / 2, footerY + 5, { align: 'center' });

      // Save PDF
      const fileName = `Overtime_Report_${employeeData?.employeeId || 'All'}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      setLoading(false);
    } catch (error) {
      console.error('Error exporting overtime report:', error);
      alert('Error exporting report. Please try again.');
      setLoading(false);
    }
  };

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

  return (
    <div className="staff-create">
      <div className="overtime-header">
        <h2>Overtime Submission</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {canSubmit && (
            <button
              type="button"
              className="btn-add-entry"
              onClick={openNewOvertimeModal}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="plus" />
              New Overtime
            </button>
          )}
          {canView && (
            <>
              <button 
                type="button"
                className="btn-view-submitted" 
                onClick={handleViewPastOvertime}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Icon name="view" />
                Past Overtime
              </button>
              {isAdminUser && submittedOvertimes.length > 0 && (
                <button 
                  type="button"
                  className="btn-clear-all" 
                  onClick={handleClearAllData}
                  disabled={loading}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    background: '#ef4444', 
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background 0.2s',
                    opacity: loading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = '#dc2626';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = '#ef4444';
                    }
                  }}
                >
                  <Icon name="delete" />
                  {loading ? 'Clearing...' : 'Clear All Data'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bulk Form - Hidden, using modal form instead */}
      {false && (
      <form onSubmit={handleSubmit} className="staff-form">
        <div className="form-row">
          <div className="form-group">
            <label>Employee ID *</label>
            {isAdminUser ? (
              <select
                value={employeeId}
                onChange={handleEmployeeChange}
                required
              >
                <option value="">Select Employee</option>
                {staffs.map(staff => (
                  <option key={staff.id} value={staff.employeeId}>
                    {staff.employeeId} - {staff.name || staff.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={employeeId}
                readOnly
                disabled
                style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                required
              />
            )}
          </div>
          <div className="form-group">
            <label>Employee Name</label>
            <input
              type="text"
              value={employeeName}
              readOnly
              disabled
              style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
            />
          </div>
        </div>

        <div className="overtime-entries">
          <div className="entries-header">
            <h3>Overtime Entries</h3>
            <button type="button" className="btn-add-entry" onClick={addEntry}>
              <Icon name="plus" />
              Add Entry
            </button>
          </div>

          {entries.map((entry, index) => (
            <div key={index} className="overtime-entry-card">
              <div className="entry-header">
                <h4>Entry {index + 1}</h4>
                {entries.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove-entry"
                    onClick={() => removeEntry(index)}
                    title="Remove entry"
                  >
                    <Icon name="delete" />
                  </button>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => handleEntryChange(index, 'date', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>From Time *</label>
                  <input
                    type="time"
                    value={entry.fromTime}
                    onChange={(e) => handleEntryChange(index, 'fromTime', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>To Time *</label>
                  <input
                    type="time"
                    value={entry.toTime}
                    onChange={(e) => handleEntryChange(index, 'toTime', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Hours (Auto-calculated)</label>
                  <input
                    type="number"
                    value={entry.hours.toFixed(2)}
                    readOnly
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  value={entry.reason}
                  onChange={(e) => handleEntryChange(index, 'reason', e.target.value)}
                  rows={3}
                  required
                  placeholder="Please provide a reason for overtime work..."
                />
              </div>
            </div>
          ))}

          <div className="total-hours">
            <strong>Total Hours: {totalHours.toFixed(2)}</strong>
          </div>
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Submitting...' : `Submit ${entries.filter(e => e.date && e.fromTime && e.toTime && e.reason).length} Entry/Entries`}
        </button>
      </form>
      )}

      {/* Submitted Overtime Table */}
      <div style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.25rem', fontWeight: '600' }}>
            Submitted Overtime Records
          </h3>
          {submittedOvertimes.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportAllRecords}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="download" />
              {loading ? 'Exporting...' : 'Export / Download PDF'}
            </button>
          )}
        </div>
        {loadingSubmitted ? (
          <Loading message="Loading records..." />
        ) : (
          <div className="staff-table-container">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Date</th>
                  <th>From Time</th>
                  <th>To Time</th>
                  <th>Hours</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submittedOvertimes.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      No submitted overtime records found
                    </td>
                  </tr>
                ) : (() => {
                  // Group records by user (employeeId or name)
                  const groupedByUser = submittedOvertimes.reduce((acc, record) => {
                    const key = record.employeeId || record.name || 'unknown';
                    if (!acc[key]) {
                      acc[key] = {
                        employeeId: record.employeeId || '',
                        employeeName: record.name || 'Unknown',
                        records: []
                      };
                    }
                    acc[key].records.push(record);
                    return acc;
                  }, {} as Record<string, { employeeId: string; employeeName: string; records: SubmittedOvertime[] }>);

                  const employeeGroups = Object.values(groupedByUser);
                  const rows: JSX.Element[] = [];

                  employeeGroups.forEach((group, groupIndex) => {
                    const totalHours = group.records.reduce((sum, r) => sum + (r.hours || 0), 0);

                    group.records.forEach((record, recordIndex) => {
                      rows.push(
                        <tr key={record.id}>
                          {recordIndex === 0 && (
                            <td rowSpan={group.records.length} style={{ verticalAlign: 'top', fontWeight: '600', background: '#f9fafb', borderRight: '2px solid #e5e7eb', padding: '12px' }}>
                              <div style={{ marginBottom: '4px' }}>{group.employeeName}</div>
                              {group.employeeId && (
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                  ({group.employeeId})
                                </div>
                              )}
                            </td>
                          )}
                          <td>
                            {record.date 
                              ? (() => {
                                  const dateParts = record.date.split('-');
                                  if (dateParts.length === 3) {
                                    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                                  }
                                  return record.date;
                                })()
                              : 'N/A'}
                          </td>
                          <td>{record.fromTime || 'N/A'}</td>
                          <td>{record.toTime || 'N/A'}</td>
                          <td>{record.hours?.toFixed(2) || '0.00'}</td>
                          <td title={record.reason || ''}>
                            {(record.reason || '').length > 50 
                              ? (record.reason || '').substring(0, 50) + '...' 
                              : record.reason || 'N/A'}
                          </td>
                          <td>
                            {isAdminUser ? (
                              <select
                                value={record.status || 'pending'}
                                onChange={(e) => handleStatusUpdate(record.id!, e.target.value)}
                                className={`status-select ${record.status || 'pending'}`}
                                style={{ minWidth: '120px' }}
                              >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="paid">Paid</option>
                              </select>
                            ) : (
                              <span className={`status-badge ${record.status || 'pending'}`}>
                                {record.status || 'pending'}
                              </span>
                            )}
                          </td>
                          <td>
                            {formatDate(record.submittedAt || record.createdAt)}
                          </td>
                          <td>
                            <div className="action-icons">
                              <button
                                type="button"
                                className="action-icon download"
                                title="Download PDF"
                                onClick={() => handleExportSingleRecord(record)}
                                disabled={loading}
                              >
                                <Icon name="download" />
                              </button>
                              {canEditDelete && (
                                <>
                                  <button
                                    type="button"
                                    className="action-icon edit"
                                    title="Edit"
                                    onClick={() => handleEdit(record)}
                                  >
                                    <Icon name="edit" />
                                  </button>
                                  <button
                                    type="button"
                                    className="action-icon delete"
                                    title="Delete"
                                    onClick={() => handleDelete(record.id)}
                                  >
                                    <Icon name="delete" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    });

                    // Add total row for this user
                    rows.push(
                      <tr key={`total-${group.employeeId || groupIndex}`} style={{ background: '#eff6ff', fontWeight: '600' }}>
                        <td colSpan={4} style={{ textAlign: 'right', padding: '12px 16px', borderTop: '2px solid #bfdbfe' }}>
                          Total Hours for {group.employeeName}:
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1e40af', borderTop: '2px solid #bfdbfe', fontSize: '1rem' }}>
                          {totalHours.toFixed(2)}
                        </td>
                        <td colSpan={4} style={{ borderTop: '2px solid #bfdbfe' }}></td>
                      </tr>
                    );
                  });

                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        )}
        {submittedOvertimes.length > 0 && (
          <div style={{ marginTop: '20px', padding: '16px 20px', background: '#f9fafb', borderRadius: '8px', textAlign: 'right' }}>
            <strong style={{ fontSize: '1rem', color: '#374151' }}>
              Total Hours: {submittedOvertimes.reduce((sum, r) => sum + (r.hours || 0), 0).toFixed(2)}
            </strong>
          </div>
        )}
      </div>

      {/* Past Overtime Modal */}
      {showPastOvertimeModal && (
        <div className="modal-overlay" onClick={() => setShowPastOvertimeModal(false)}>
          <div className="modal-content overtime-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Past Overtime Records</h3>
              <button 
                type="button"
                className="close-btn" 
                onClick={() => setShowPastOvertimeModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {loadingPastOvertimes ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p className="loading-text">Loading records...</p>
                </div>
              ) : (
                <div>
                  {pastOvertimes.length === 0 ? (
                    <div className="staff-table-container">
                      <table className="staff-table">
                        <thead>
                          <tr>
                            <th>User Name</th>
                            <th>Date</th>
                            <th>From Time</th>
                            <th>To Time</th>
                            <th>Hours</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Submitted At</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                              No past overtime records found
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (() => {
                    // Group records by resetMonth
                    const groupedByMonth = pastOvertimes.reduce((acc, record) => {
                      const month = record.resetMonth || 'Unknown Month';
                      if (!acc[month]) {
                        acc[month] = [];
                      }
                      acc[month].push(record);
                      return acc;
                    }, {} as Record<string, SubmittedOvertime[]>);

                    const months = Object.keys(groupedByMonth).sort((a, b) => {
                      // Sort months in reverse order (newest first)
                      return b.localeCompare(a);
                    });

                    return months.map((month, monthIndex) => {
                      const monthRecords = groupedByMonth[month];
                      const monthTotalHours = monthRecords.reduce((sum, r) => sum + (r.hours || 0), 0);

                      return (
                        <div key={month} style={{ marginBottom: monthIndex < months.length - 1 ? '40px' : '0' }}>
                          <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ fontSize: '1.1rem', color: '#0369a1' }}>
                                  {month}
                                </strong>
                              </div>
                              <div style={{ fontSize: '1rem', color: '#0369a1', fontWeight: '600' }}>
                                Total Hours: {monthTotalHours.toFixed(2)} | Records: {monthRecords.length}
                              </div>
                            </div>
                          </div>
                          <div className="staff-table-container">
                            <table className="staff-table">
                              <thead>
                                <tr>
                                  <th>User Name</th>
                                  <th>Date</th>
                                  <th>From Time</th>
                                  <th>To Time</th>
                                  <th>Hours</th>
                                  <th>Reason</th>
                                  <th>Status</th>
                                  <th>Submitted At</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Group records by user within the month
                                  const groupedByUser = monthRecords.reduce((acc, record) => {
                                    const key = record.employeeId || record.name || 'unknown';
                                    if (!acc[key]) {
                                      acc[key] = {
                                        employeeId: record.employeeId || '',
                                        employeeName: record.name || 'Unknown',
                                        records: []
                                      };
                                    }
                                    acc[key].records.push(record);
                                    return acc;
                                  }, {} as Record<string, { employeeId: string; employeeName: string; records: SubmittedOvertime[] }>);

                                  const employeeGroups = Object.values(groupedByUser);
                                  const rows: JSX.Element[] = [];

                                  employeeGroups.forEach((group, groupIndex) => {
                                    const userTotalHours = group.records.reduce((sum, r) => sum + (r.hours || 0), 0);

                                    group.records.forEach((record, recordIndex) => {
                                      rows.push(
                                        <tr key={record.id}>
                                          {recordIndex === 0 && (
                                            <td rowSpan={group.records.length} style={{ verticalAlign: 'top', fontWeight: '600', background: '#f9fafb', borderRight: '2px solid #e5e7eb', padding: '12px' }}>
                                              <div style={{ marginBottom: '4px' }}>{group.employeeName}</div>
                                              {group.employeeId && (
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                  ({group.employeeId})
                                                </div>
                                              )}
                                            </td>
                                          )}
                                          <td>
                                            {record.date 
                                              ? (() => {
                                                  const dateParts = record.date.split('-');
                                                  if (dateParts.length === 3) {
                                                    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                                                  }
                                                  return record.date;
                                                })()
                                              : 'N/A'}
                                          </td>
                                          <td>{record.fromTime || 'N/A'}</td>
                                          <td>{record.toTime || 'N/A'}</td>
                                          <td>{record.hours?.toFixed(2) || '0.00'}</td>
                                          <td title={record.reason || ''}>
                                            {(record.reason || '').length > 50 
                                              ? (record.reason || '').substring(0, 50) + '...' 
                                              : record.reason || 'N/A'}
                                          </td>
                                          <td>
                                            {isAdminUser ? (
                                              <select
                                                value={record.status || 'pending'}
                                                onChange={(e) => handleStatusUpdate(record.id!, e.target.value)}
                                                className={`status-select ${record.status || 'pending'}`}
                                                style={{ minWidth: '120px' }}
                                              >
                                                <option value="pending">Pending</option>
                                                <option value="approved">Approved</option>
                                                <option value="rejected">Rejected</option>
                                                <option value="paid">Paid</option>
                                              </select>
                                            ) : (
                                              <span className={`status-badge ${record.status || 'pending'}`}>
                                                {record.status || 'pending'}
                                              </span>
                                            )}
                                          </td>
                                          <td>
                                            {formatDate(record.submittedAt || record.createdAt)}
                                          </td>
                                        </tr>
                                      );
                                    });

                                    // Add total row for this user
                                    rows.push(
                                      <tr key={`total-${group.employeeId || groupIndex}`} style={{ background: '#eff6ff', fontWeight: '600' }}>
                                        <td colSpan={4} style={{ textAlign: 'right', padding: '12px 16px', borderTop: '2px solid #bfdbfe' }}>
                                          Total Hours for {group.employeeName}:
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#1e40af', borderTop: '2px solid #bfdbfe', fontSize: '1rem' }}>
                                          {userTotalHours.toFixed(2)}
                                        </td>
                                        <td colSpan={3} style={{ borderTop: '2px solid #bfdbfe' }}></td>
                                      </tr>
                                    );
                                  });

                                  return rows;
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            {pastOvertimes.length > 0 && (
              <div style={{ padding: '16px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
                <strong style={{ fontSize: '1rem', color: '#374151' }}>
                  Total Hours: {pastOvertimes.reduce((sum, r) => sum + (r.hours || 0), 0).toFixed(2)}
                </strong>
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowPastOvertimeModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Overtime Modal */}
      {showNewOvertimeModal && (
        <div className="modal-overlay" onClick={() => {
          setShowNewOvertimeModal(false);
          setEditingOvertime(null);
        }}>
          <div className="modal-content overtime-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingOvertime ? 'Edit Overtime Entry' : 'New Overtime Entry'}</h3>
              <button 
                type="button"
                className="close-btn" 
                onClick={() => {
                  setShowNewOvertimeModal(false);
                  setEditingOvertime(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSingleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Employee ID *</label>
                    {isAdminUser ? (
                      <select
                        value={singleEntry.employeeId}
                        onChange={(e) => handleSingleEntryChange('employeeId', e.target.value)}
                        required
                      >
                        <option value="">Select Employee</option>
                        {staffs.map(staff => (
                          <option key={staff.id} value={staff.employeeId}>
                            {staff.employeeId} - {staff.name || staff.fullName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={singleEntry.employeeId}
                        readOnly
                        disabled
                        style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                        required
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Employee Name *</label>
                    <input
                      type="text"
                      value={singleEntry.employeeName}
                      onChange={(e) => handleSingleEntryChange('employeeName', e.target.value)}
                      readOnly={!isAdminUser}
                      disabled={!isAdminUser}
                      style={!isAdminUser ? { background: '#f3f4f6', cursor: 'not-allowed' } : {}}
                      required
                    />
                  </div>
                </div>

                {editingOvertime ? (
                  // Single entry form for editing
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Date *</label>
                        <input
                          type="date"
                          value={singleEntry.date}
                          onChange={(e) => handleSingleEntryChange('date', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>From Time *</label>
                        <input
                          type="time"
                          value={singleEntry.fromTime}
                          onChange={(e) => handleSingleEntryChange('fromTime', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>To Time *</label>
                        <input
                          type="time"
                          value={singleEntry.toTime}
                          onChange={(e) => handleSingleEntryChange('toTime', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Hours (Auto-calculated)</label>
                        <input
                          type="number"
                          value={singleEntry.hours.toFixed(2)}
                          readOnly
                          disabled
                          style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                        />
                      </div>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label>Reason *</label>
                        <textarea
                          value={singleEntry.reason}
                          onChange={(e) => handleSingleEntryChange('reason', e.target.value)}
                          rows={3}
                          required
                          placeholder="Please provide a reason for overtime work..."
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // Multiple entries form for creating
                  <div className="overtime-entries">
                    <div className="entries-header">
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Overtime Entries</h4>
                      <button 
                        type="button" 
                        className="btn-add-entry" 
                        onClick={addModalEntry}
                        style={{ padding: '6px 12px', fontSize: '0.875rem' }}
                      >
                        <Icon name="plus" />
                        Add Entry
                      </button>
                    </div>

                    {modalEntries.map((entry, index) => (
                      <div key={index} className="overtime-entry-card" style={{ marginBottom: '16px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <div className="entry-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                          <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600' }}>Entry {index + 1}</h5>
                          {modalEntries.length > 1 && (
                            <button
                              type="button"
                              className="btn-remove-entry"
                              onClick={() => removeModalEntry(index)}
                              title="Remove entry"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <Icon name="delete" />
                            </button>
                          )}
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Date *</label>
                            <input
                              type="date"
                              value={entry.date}
                              onChange={(e) => handleModalEntryChange(index, 'date', e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>From Time *</label>
                            <input
                              type="time"
                              value={entry.fromTime}
                              onChange={(e) => handleModalEntryChange(index, 'fromTime', e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>To Time *</label>
                            <input
                              type="time"
                              value={entry.toTime}
                              onChange={(e) => handleModalEntryChange(index, 'toTime', e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Hours (Auto-calculated)</label>
                            <input
                              type="number"
                              value={entry.hours.toFixed(2)}
                              readOnly
                              disabled
                              style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Reason *</label>
                          <textarea
                            value={entry.reason}
                            onChange={(e) => handleModalEntryChange(index, 'reason', e.target.value)}
                            rows={3}
                            required
                            placeholder="Please provide a reason for overtime work..."
                          />
                        </div>
                      </div>
                    ))}

                    <div className="total-hours" style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', textAlign: 'right' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#1e40af' }}>
                        Total Hours: {modalEntries.reduce((sum, entry) => sum + entry.hours, 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}

                {message && (
                  <div className={`message ${message.includes('Error') ? 'error' : 'success'}`} style={{ marginTop: '16px' }}>
                    {message}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowNewOvertimeModal(false);
                    setEditingOvertime(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading 
                    ? (editingOvertime ? 'Updating...' : 'Submitting...') 
                    : (editingOvertime 
                        ? 'Update Overtime' 
                        : `Submit ${modalEntries.filter(e => e.date && e.fromTime && e.toTime && e.reason).length} Entry/Entries`
                      )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overtime;
