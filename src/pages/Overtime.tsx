import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, doc, getDoc, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { fetchUserRole, isAdmin } from '../utils/userRole';
import { usePagePermissions } from '../hooks/usePagePermissions';
import Icon from '../components/Icons';
import jsPDF from 'jspdf';
// Extend jsPDF with autoTable
import 'jspdf-autotable';
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
        const { fetchAllEmployees } = await import('../utils/fetchEmployees');
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
        const { fetchAllEmployees } = await import('../utils/fetchEmployees');
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
      console.error('Error fetching past overtimes:', error);
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
  }, [currentUserId, isAdminUser, currentUserData, fetchSubmittedOvertimes]);

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
      console.error('Error fetching current user data:', error);
    }
  };

  const fetchStaffs = async () => {
    try {
      const { fetchAllEmployees } = await import('../utils/fetchEmployees');
      const employees = await fetchAllEmployees();
      setStaffs(employees);
    } catch (error) {
      console.error('Error fetching staffs:', error);
    }
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
    
    // Convert to hours with 2 decimal places
    return Math.round((diffMinutes / 60) * 100) / 100;
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

  const handleExportSingleRecord = async (record: SubmittedOvertime) => {
    try {
      setLoading(true);
      
      // Dynamically import jspdf-autotable to ensure it loads
      await import('jspdf-autotable');
      
      // Create PDF for single record
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
      doc.setTextColor(0, 102, 153);
      doc.setFont('helvetica', 'bold');
      doc.text('FOCUS MEDICAL CENTRE', pageWidth / 2, yPos + 10, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('فوكاس ميديكال سنتر', pageWidth / 2, yPos + 16, { align: 'center' });

      yPos = 40;

      // Report Title
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('OVERTIME RECORD', pageWidth / 2, yPos, { align: 'center' });

      yPos += 20;

      // Employee Information
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Employee Information', 20, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      yPos += 10;
      doc.text(`Employee ID: ${record.employeeId || 'N/A'}`, 20, yPos);
      yPos += 7;
      doc.text(`Employee Name: ${record.name || 'N/A'}`, 20, yPos);

      // Report Date
      const reportDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      doc.text(`Report Generated: ${reportDate}`, pageWidth - 20, yPos - 17, { align: 'right' });

      yPos += 20;

      // Overtime Details
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Overtime Details', 20, yPos);
      
      yPos += 10;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      const details = [
        ['Date:', record.date || 'N/A'],
        ['From Time:', record.fromTime || 'N/A'],
        ['To Time:', record.toTime || 'N/A'],
        ['Total Hours:', (record.hours || 0).toFixed(2)],
        ['Status:', (record.status || 'pending').toUpperCase()],
        ['Submitted At:', record.submittedAt?.toDate?.()?.toLocaleString() || 
                          record.createdAt?.toDate?.()?.toLocaleString() || 'N/A']
      ];

      details.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 20, yPos);
        doc.setFont('helvetica', 'normal');
        const textWidth = doc.getTextWidth(value);
        doc.text(value, pageWidth - 20 - textWidth, yPos, { align: 'right' });
        yPos += 8;
      });

      yPos += 10;

      // Reason
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Reason:', 20, yPos);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const reasonText = record.reason || 'N/A';
      const splitReason = doc.splitTextToSize(reasonText, pageWidth - 40);
      doc.text(splitReason, 20, yPos);
      yPos += splitReason.length * 5 + 15;

      // Footer
      const footerY = pageHeight - 20;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text('This is a computer-generated document. No signature required.', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 5, { align: 'center' });

      // Save PDF
      const fileName = `Overtime_${record.employeeId || 'Record'}_${record.date || new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      setLoading(false);
    } catch (error) {
      console.error('Error exporting overtime record:', error);
      alert('Error exporting record. Please try again.');
      setLoading(false);
    }
  };

  const handleExportCurrentTable = async () => {
    try {
      setLoading(true);
      
      // Dynamically import jspdf-autotable to ensure it loads
      await import('jspdf-autotable');
      
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
      const reportDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
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
        record.date || 'N/A',
        record.fromTime || 'N/A',
        record.toTime || 'N/A',
        (record.hours || 0).toFixed(2),
        (record.reason || '').substring(0, 40) + ((record.reason || '').length > 40 ? '...' : ''),
        record.status || 'pending'
      ]);

      // Add table
      (doc as any).autoTable({
        startY: yPos,
        head: [['Date', 'From Time', 'To Time', 'Hours', 'Reason', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [0, 102, 153], // Teal header
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [245, 250, 255] // Light teal background
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 50 },
          5: { cellWidth: 25, halign: 'center' }
        },
        margin: { left: 20, right: 20 }
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
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 5, { align: 'center' });

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
      
      // Dynamically import jspdf-autotable to ensure it loads
      await import('jspdf-autotable');
      
      // Fetch all overtime records for the current employee
      let overtimeSnapshot;
      let employeeData: { employeeId: string; name: string } | null = null;
      
      if (isAdminUser) {
        overtimeSnapshot = await getDocs(collection(db, 'overtime'));
      } else {
        const { fetchAllEmployees } = await import('../utils/fetchEmployees');
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
      const reportDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
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
        record.date || 'N/A',
        record.fromTime || 'N/A',
        record.toTime || 'N/A',
        (record.hours || 0).toFixed(2),
        (record.reason || '').substring(0, 40) + ((record.reason || '').length > 40 ? '...' : ''),
        record.status || 'pending'
      ]);

      // Add table
      (doc as any).autoTable({
        startY: yPos,
        head: [['Date', 'From Time', 'To Time', 'Hours', 'Reason', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [0, 102, 153], // Teal header
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0]
        },
        alternateRowStyles: {
          fillColor: [245, 250, 255] // Light teal background
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 50 },
          5: { cellWidth: 25, halign: 'center' }
        },
        margin: { left: 20, right: 20 }
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
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 5, { align: 'center' });

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
              <button 
                type="button"
                className="btn-export" 
                onClick={handleExport}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Icon name="download" />
                {loading ? 'Generating PDF...' : 'Download PDF Report'}
              </button>
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
          {submittedOvertimes.length > 0 && canView && (
            <button
              type="button"
              className="btn-export"
              onClick={handleExportCurrentTable}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="download" />
              {loading ? 'Generating PDF...' : 'Download PDF'}
            </button>
          )}
        </div>
        {loadingSubmitted ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Loading records...</p>
          </div>
        ) : submittedOvertimes.length === 0 ? (
          <div className="no-data" style={{ padding: '40px', textAlign: 'center' }}>
            <p>No submitted overtime records found</p>
          </div>
        ) : (
          <div className="staff-table-container">
            <table className="staff-table">
              <thead>
                <tr>
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
                {submittedOvertimes.map((record) => (
                  <tr key={record.id}>
                    <td>{record.date || 'N/A'}</td>
                    <td>{record.fromTime || 'N/A'}</td>
                    <td>{record.toTime || 'N/A'}</td>
                    <td>{record.hours?.toFixed(2) || '0.00'}</td>
                    <td title={record.reason || ''}>
                      {(record.reason || '').length > 50 
                        ? (record.reason || '').substring(0, 50) + '...' 
                        : record.reason || 'N/A'}
                    </td>
                    <td>
                      <span className={`status-badge ${record.status || 'pending'}`}>
                        {record.status || 'pending'}
                      </span>
                    </td>
                    <td>
                      {record.submittedAt?.toDate?.()?.toLocaleString() || 
                       record.createdAt?.toDate?.()?.toLocaleString() || 
                       'N/A'}
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
                ))}
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
              ) : pastOvertimes.length === 0 ? (
                <div className="no-data" style={{ padding: '40px', textAlign: 'center' }}>
                  <p>No past overtime records found</p>
                </div>
              ) : (
                <div className="staff-table-container">
                  <table className="staff-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>From Time</th>
                        <th>To Time</th>
                        <th>Hours</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Reset Month</th>
                        <th>Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastOvertimes.map((record) => (
                        <tr key={record.id}>
                          <td>{record.date || 'N/A'}</td>
                          <td>{record.fromTime || 'N/A'}</td>
                          <td>{record.toTime || 'N/A'}</td>
                          <td>{record.hours?.toFixed(2) || '0.00'}</td>
                          <td title={record.reason || ''}>
                            {(record.reason || '').length > 50 
                              ? (record.reason || '').substring(0, 50) + '...' 
                              : record.reason || 'N/A'}
                          </td>
                          <td>
                            <span className={`status-badge ${record.status || 'pending'}`}>
                              {record.status || 'pending'}
                            </span>
                          </td>
                          <td>{record.resetMonth || 'N/A'}</td>
                          <td>
                            {record.submittedAt?.toDate?.()?.toLocaleString() || 
                             record.createdAt?.toDate?.()?.toLocaleString() || 
                             'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
