import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { getEmployeeCount, fetchAllEmployees } from '../utils/fetchEmployees';
import { fetchUserRole, isAdmin } from '../utils/userRole';
import Icon from '../components/Icons';
import './Dashboard.css';

interface Warning {
  id: string;
  type: 'expired_document' | 'expiring_document' | 'pending_fine' | 'overdue_leave' | 'pending_payroll';
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  link?: string;
  employeeId?: string;
  employeeName?: string;
}

interface RecentActivity {
  id: string;
  type: 'leave' | 'request' | 'complaint' | 'payroll' | 'fine' | 'overtime';
  title: string;
  description: string;
  employeeId?: string;
  employeeName?: string;
  status?: string;
  date: any;
  link?: string;
}

interface UserLoginInfo {
  userId: string;
  email: string;
  name: string;
  role: string;
  employeeId?: string;
  department?: string;
  lastLogin?: any;
  loginCount?: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStaffs: 0,
    pendingLeaves: 0,
    activeRequests: 0,
    unresolvedComplaints: 0,
    pendingFines: 0,
    pendingPayrolls: 0
  });
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [userLoginInfo, setUserLoginInfo] = useState<UserLoginInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        setIsAdminUser(isAdmin(role));
        await Promise.all([
          fetchStats(user.uid, role),
          fetchWarnings(user.uid, role),
          fetchRecentActivities(user.uid, role),
          fetchUserLoginInfo(user.uid)
        ]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchStats = async (uid: string, role: string) => {
    try {
      const adminUser = isAdmin(role);

      if (adminUser) {
        // Admin can see all stats
        const totalStaffs = await getEmployeeCount();
        setStats(prev => ({ ...prev, totalStaffs }));

        // Fetch pending leaves
        const leavesSnapshot = await getDocs(collection(db, 'leaves'));
        const pendingLeaves = leavesSnapshot.docs.filter(
          doc => doc.data().status === 'pending'
        ).length;
        setStats(prev => ({ ...prev, pendingLeaves }));

        // Fetch active requests
        const requestsSnapshot = await getDocs(collection(db, 'requests'));
        const activeRequests = requestsSnapshot.docs.filter(
          doc => doc.data().status === 'active' || doc.data().status === 'pending'
        ).length;
        setStats(prev => ({ ...prev, activeRequests }));

        // Fetch unresolved complaints
        const complaintsSnapshot = await getDocs(collection(db, 'complaints'));
        const unresolvedComplaints = complaintsSnapshot.docs.filter(
          doc => doc.data().status !== 'resolved'
        ).length;
        setStats(prev => ({ ...prev, unresolvedComplaints }));

        // Fetch pending fines
        const finesSnapshot = await getDocs(query(collection(db, 'fines'), where('status', '==', 'pending')));
        setStats(prev => ({ ...prev, pendingFines: finesSnapshot.docs.length }));

        // Fetch pending payrolls
        const payrollsSnapshot = await getDocs(query(collection(db, 'payrolls'), where('status', '==', 'pending')));
        setStats(prev => ({ ...prev, pendingPayrolls: payrollsSnapshot.docs.length }));
      } else {
        // Non-admin users see only their own data
        setStats(prev => ({ ...prev, totalStaffs: 1 }));

        // Fetch only user's own leaves
        const leavesQuery = query(collection(db, 'leaves'), where('employeeId', '==', uid));
        const leavesSnapshot = await getDocs(leavesQuery);
        const pendingLeaves = leavesSnapshot.docs.filter(
          doc => doc.data().status === 'pending'
        ).length;
        setStats(prev => ({ ...prev, pendingLeaves }));

        // Fetch only user's own requests
        const requestsQuery = query(collection(db, 'requests'), where('employeeId', '==', uid));
        const requestsSnapshot = await getDocs(requestsQuery);
        const activeRequests = requestsSnapshot.docs.filter(
          doc => doc.data().status === 'active' || doc.data().status === 'pending'
        ).length;
        setStats(prev => ({ ...prev, activeRequests }));

        // Fetch only user's own complaints
        const complaintsQuery = query(collection(db, 'complaints'), where('employeeId', '==', uid));
        const complaintsSnapshot = await getDocs(complaintsQuery);
        const unresolvedComplaints = complaintsSnapshot.docs.filter(
          doc => doc.data().status !== 'resolved'
        ).length;
        setStats(prev => ({ ...prev, unresolvedComplaints }));

        // Fetch user's pending fines
        const allEmployees = await fetchAllEmployees();
        const userEmployee = allEmployees.find(emp => emp.id === uid || emp.authUserId === uid);
        if (userEmployee?.employeeId) {
          const finesQuery = query(
            collection(db, 'fines'),
            where('employeeId', '==', userEmployee.employeeId),
            where('status', '==', 'pending')
          );
          const finesSnapshot = await getDocs(finesQuery);
          setStats(prev => ({ ...prev, pendingFines: finesSnapshot.docs.length }));
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchWarnings = async (uid: string, role: string) => {
    try {
      const warningsList: Warning[] = [];
      const adminUser = isAdmin(role);
      const allEmployees = await fetchAllEmployees();
      const userEmployee = allEmployees.find(emp => emp.id === uid || emp.authUserId === uid);

      // Check for expired/expiring documents
      const employeesToCheck = adminUser ? allEmployees : (userEmployee ? [userEmployee] : []);
      
      employeesToCheck.forEach(emp => {
        const empData = emp as any;
        
        // Check QID expiry
        if (empData.qidExpiryDate) {
          const qidExpiry = new Date(empData.qidExpiryDate);
          const today = new Date();
          const diffDays = Math.ceil((qidExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            warningsList.push({
              id: `qid-expired-${emp.id}`,
              type: 'expired_document',
              title: 'Expired QID',
              message: `${empData.name || empData.fullName || empData.employeeId}'s QID has expired`,
              severity: 'high',
              link: '/documents',
              employeeId: empData.employeeId,
              employeeName: empData.name || empData.fullName
            });
          } else if (diffDays <= 30) {
            warningsList.push({
              id: `qid-expiring-${emp.id}`,
              type: 'expiring_document',
              title: 'QID Expiring Soon',
              message: `${empData.name || empData.fullName || empData.employeeId}'s QID expires in ${diffDays} days`,
              severity: 'medium',
              link: '/documents',
              employeeId: empData.employeeId,
              employeeName: empData.name || empData.fullName
            });
          }
        }

        // Check Passport expiry
        if (empData.passportValidityDate) {
          const passportExpiry = new Date(empData.passportValidityDate);
          const today = new Date();
          const diffDays = Math.ceil((passportExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            warningsList.push({
              id: `passport-expired-${emp.id}`,
              type: 'expired_document',
              title: 'Expired Passport',
              message: `${empData.name || empData.fullName || empData.employeeId}'s Passport has expired`,
              severity: 'high',
              link: '/documents',
              employeeId: empData.employeeId,
              employeeName: empData.name || empData.fullName
            });
          } else if (diffDays <= 30) {
            warningsList.push({
              id: `passport-expiring-${emp.id}`,
              type: 'expiring_document',
              title: 'Passport Expiring Soon',
              message: `${empData.name || empData.fullName || empData.employeeId}'s Passport expires in ${diffDays} days`,
              severity: 'medium',
              link: '/documents',
              employeeId: empData.employeeId,
              employeeName: empData.name || empData.fullName
            });
          }
        }

        // Check Medical License expiry
        if (empData.licenseValidityDate) {
          const licenseExpiry = new Date(empData.licenseValidityDate);
          const today = new Date();
          const diffDays = Math.ceil((licenseExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            warningsList.push({
              id: `license-expired-${emp.id}`,
              type: 'expired_document',
              title: 'Expired Medical License',
              message: `${empData.name || empData.fullName || empData.employeeId}'s Medical License has expired`,
              severity: 'high',
              link: '/documents',
              employeeId: empData.employeeId,
              employeeName: empData.name || empData.fullName
            });
          } else if (diffDays <= 30) {
            warningsList.push({
              id: `license-expiring-${emp.id}`,
              type: 'expiring_document',
              title: 'Medical License Expiring Soon',
              message: `${empData.name || empData.fullName || empData.employeeId}'s Medical License expires in ${diffDays} days`,
              severity: 'medium',
              link: '/documents',
              employeeId: empData.employeeId,
              employeeName: empData.name || empData.fullName
            });
          }
        }
      });

      // Check for pending fines
      if (adminUser) {
        const pendingFinesSnapshot = await getDocs(query(collection(db, 'fines'), where('status', '==', 'pending')));
        pendingFinesSnapshot.docs.forEach(doc => {
          const fine = doc.data();
          warningsList.push({
            id: `fine-${doc.id}`,
            type: 'pending_fine',
            title: 'Pending Fine',
            message: `${fine.employeeName || fine.employeeId} has a pending fine`,
            severity: 'medium',
            link: '/fines',
            employeeId: fine.employeeId,
            employeeName: fine.employeeName
          });
        });
      } else if (userEmployee?.employeeId) {
        const pendingFinesSnapshot = await getDocs(query(
          collection(db, 'fines'),
          where('employeeId', '==', userEmployee.employeeId),
          where('status', '==', 'pending')
        ));
        pendingFinesSnapshot.docs.forEach(doc => {
          const fine = doc.data();
          warningsList.push({
            id: `fine-${doc.id}`,
            type: 'pending_fine',
            title: 'Pending Fine',
            message: `You have a pending fine: ${fine.reason}`,
            severity: 'medium',
            link: '/fines',
            employeeId: fine.employeeId,
            employeeName: fine.employeeName
          });
        });
      }

      // Check for pending payrolls (admin only)
      if (adminUser) {
        const pendingPayrollsSnapshot = await getDocs(query(collection(db, 'payrolls'), where('status', '==', 'pending')));
        if (pendingPayrollsSnapshot.docs.length > 0) {
          warningsList.push({
            id: 'pending-payrolls',
            type: 'pending_payroll',
            title: 'Pending Payrolls',
            message: `${pendingPayrollsSnapshot.docs.length} payroll record(s) pending approval`,
            severity: 'low',
            link: '/payrolls/management'
          });
        }
      }

      setWarnings(warningsList.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }));
    } catch (error) {
      console.error('Error fetching warnings:', error);
    }
  };

  const fetchRecentActivities = async (uid: string, role: string) => {
    try {
      const activities: RecentActivity[] = [];
      const adminUser = isAdmin(role);
      const allEmployees = await fetchAllEmployees();
      const userEmployee = allEmployees.find(emp => emp.id === uid || emp.authUserId === uid);

      // Fetch recent leaves
      let leavesQuery;
      if (adminUser) {
        leavesQuery = query(collection(db, 'leaves'), orderBy('createdAt', 'desc'), limit(5));
      } else if (userEmployee?.employeeId) {
        leavesQuery = query(
          collection(db, 'leaves'),
          where('employeeId', '==', userEmployee.employeeId),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
      }
      if (leavesQuery) {
        const leavesSnapshot = await getDocs(leavesQuery);
        leavesSnapshot.docs.forEach(doc => {
          const leave = doc.data();
          activities.push({
            id: `leave-${doc.id}`,
            type: 'leave',
            title: 'Leave Request',
            description: `${leave.name || leave.employeeId} - ${leave.leaveType} (${leave.status})`,
            employeeId: leave.employeeId,
            employeeName: leave.name,
            status: leave.status,
            date: leave.createdAt,
            link: '/leave/status'
          });
        });
      }

      // Fetch recent requests
      let requestsQuery;
      if (adminUser) {
        requestsQuery = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(5));
      } else if (userEmployee?.employeeId) {
        requestsQuery = query(
          collection(db, 'requests'),
          where('employeeId', '==', userEmployee.employeeId),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
      }
      if (requestsQuery) {
        const requestsSnapshot = await getDocs(requestsQuery);
        requestsSnapshot.docs.forEach(doc => {
          const request = doc.data();
          activities.push({
            id: `request-${doc.id}`,
            type: 'request',
            title: 'Item Request',
            description: `${request.name || request.employeeId} - ${request.itemName} (${request.status})`,
            employeeId: request.employeeId,
            employeeName: request.name,
            status: request.status,
            date: request.createdAt,
            link: '/requests'
          });
        });
      }

      // Fetch recent complaints
      let complaintsQuery;
      if (adminUser) {
        complaintsQuery = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(5));
      } else if (userEmployee?.employeeId) {
        complaintsQuery = query(
          collection(db, 'complaints'),
          where('employeeId', '==', userEmployee.employeeId),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
      }
      if (complaintsQuery) {
        const complaintsSnapshot = await getDocs(complaintsQuery);
        complaintsSnapshot.docs.forEach(doc => {
          const complaint = doc.data();
          activities.push({
            id: `complaint-${doc.id}`,
            type: 'complaint',
            title: 'Complaint',
            description: `${complaint.name || complaint.employeeId} - ${complaint.subject} (${complaint.status})`,
            employeeId: complaint.employeeId,
            employeeName: complaint.name,
            status: complaint.status,
            date: complaint.createdAt,
            link: '/complaints'
          });
        });
      }

      // Fetch recent payrolls (admin only)
      if (adminUser) {
        const payrollsQuery = query(collection(db, 'payrolls'), orderBy('createdAt', 'desc'), limit(5));
        const payrollsSnapshot = await getDocs(payrollsQuery);
        payrollsSnapshot.docs.forEach(doc => {
          const payroll = doc.data();
          activities.push({
            id: `payroll-${doc.id}`,
            type: 'payroll',
            title: 'Payroll Record',
            description: `${payroll.employeeName || payroll.employeeId} - ${payroll.month} ${payroll.year} (${payroll.status})`,
            employeeId: payroll.employeeId,
            employeeName: payroll.employeeName,
            status: payroll.status,
            date: payroll.createdAt,
            link: '/payrolls/management'
          });
        });
      }

      // Fetch recent fines
      let finesQuery;
      if (adminUser) {
        finesQuery = query(collection(db, 'fines'), orderBy('createdAt', 'desc'), limit(5));
      } else if (userEmployee?.employeeId) {
        finesQuery = query(
          collection(db, 'fines'),
          where('employeeId', '==', userEmployee.employeeId),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
      }
      if (finesQuery) {
        const finesSnapshot = await getDocs(finesQuery);
        finesSnapshot.docs.forEach(doc => {
          const fine = doc.data();
          activities.push({
            id: `fine-${doc.id}`,
            type: 'fine',
            title: 'Fine',
            description: `${fine.employeeName || fine.employeeId} - ${fine.reason.substring(0, 50)}... (${fine.status})`,
            employeeId: fine.employeeId,
            employeeName: fine.employeeName,
            status: fine.status,
            date: fine.createdAt,
            link: '/fines'
          });
        });
      }

      // Sort by date (most recent first)
      activities.sort((a, b) => {
        const dateA = a.date?.toDate?.()?.getTime() || 0;
        const dateB = b.date?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
      });

      setRecentActivities(activities.slice(0, 10));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  const fetchUserLoginInfo = async (uid: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const allEmployees = await fetchAllEmployees();
      const userEmployee = allEmployees.find(emp => emp.id === uid || emp.authUserId === uid);
      const role = await fetchUserRole(uid);

      // Try to get login info from Firestore
      let loginInfo: any = null;
      try {
        const loginDoc = await getDoc(doc(db, 'userLogins', uid));
        if (loginDoc.exists()) {
          loginInfo = loginDoc.data();
        }
      } catch (error) {
        // Login info collection might not exist, that's okay
      }

      setUserLoginInfo({
        userId: uid,
        email: user.email || '',
        name: userEmployee?.name || userEmployee?.fullName || 'User',
        role: role,
        employeeId: userEmployee?.employeeId,
        department: userEmployee?.department,
        lastLogin: loginInfo?.lastLogin || new Date(),
        loginCount: loginInfo?.loginCount || 1
      });

      // Update login info in Firestore
      try {
        const loginDocRef = doc(db, 'userLogins', uid);
        const existingDoc = await getDoc(loginDocRef);
        
        if (existingDoc.exists()) {
          const existingData = existingDoc.data();
          await updateDoc(loginDocRef, {
            lastLogin: new Date(),
            loginCount: (existingData.loginCount || 0) + 1,
            updatedAt: new Date()
          });
        } else {
          await setDoc(loginDocRef, {
            userId: uid,
            email: user.email,
            lastLogin: new Date(),
            loginCount: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } catch (error) {
        console.error('Error updating login info:', error);
      }
    } catch (error) {
      console.error('Error fetching user login info:', error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'leave': return 'calendar';
      case 'request': return 'file-text';
      case 'complaint': return 'alert-circle';
      case 'payroll': return 'dollar-sign';
      case 'fine': return 'alert-triangle';
      case 'overtime': return 'clock';
      default: return 'file-text';
    }
  };

  const getWarningIcon = (type: string) => {
    switch (type) {
      case 'expired_document': return 'alert-circle';
      case 'expiring_document': return 'alert-triangle';
      case 'pending_fine': return 'alert-triangle';
      case 'pending_payroll': return 'dollar-sign';
      default: return 'alert-circle';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const statCards = [
    { title: 'Total Staffs', value: stats.totalStaffs, icon: 'users', color: '#3b82f6' },
    { title: 'Pending Leaves', value: stats.pendingLeaves, icon: 'calendar', color: '#f59e0b' },
    { title: 'Active Requests', value: stats.activeRequests, icon: 'file-text', color: '#10b981' },
    { title: 'Unresolved Complaints', value: stats.unresolvedComplaints, icon: 'alert-circle', color: '#ef4444' },
    { title: 'Pending Fines', value: stats.pendingFines, icon: 'alert-triangle', color: '#f59e0b' },
    { title: 'Pending Payrolls', value: stats.pendingPayrolls, icon: 'dollar-sign', color: '#8b5cf6' }
  ];

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        {userLoginInfo && (
          <div className="user-welcome">
            <span>Welcome, <strong>{userLoginInfo.name}</strong></span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card" style={{ borderTopColor: card.color }}>
            <div className="stat-icon" style={{ backgroundColor: card.color + '20' }}>
              <Icon name={card.icon} />
            </div>
            <div className="stat-content">
              <h3>{card.title}</h3>
              <p className="stat-value">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid - Desktop Layout */}
      <div className="dashboard-content-grid">
        {/* Warnings Section */}
        <div className="dashboard-section warnings-section">
          <div className="section-header">
            <div className="section-title">
              <Icon name="alert-triangle" />
              <h3>Warnings & Alerts</h3>
              {warnings.length > 0 && <span className="badge">{warnings.length}</span>}
            </div>
          </div>
          <div className="warnings-list">
            {warnings.length === 0 ? (
              <div className="empty-state">
                <Icon name="check-circle" />
                <p>No warnings at this time</p>
              </div>
            ) : (
              warnings.map((warning) => (
                <div 
                  key={warning.id} 
                  className={`warning-card severity-${warning.severity}`}
                  onClick={() => warning.link && (window.location.href = warning.link)}
                  style={{ cursor: warning.link ? 'pointer' : 'default' }}
                >
                  <div className="warning-icon" style={{ color: getSeverityColor(warning.severity) }}>
                    <Icon name={getWarningIcon(warning.type)} />
                  </div>
                  <div className="warning-content">
                    <h4>{warning.title}</h4>
                    <p>{warning.message}</p>
                    {warning.employeeName && (
                      <span className="warning-employee">{warning.employeeName}</span>
                    )}
                  </div>
                  <div className="warning-severity" style={{ backgroundColor: getSeverityColor(warning.severity) + '20', color: getSeverityColor(warning.severity) }}>
                    {warning.severity}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activities Section */}
        <div className="dashboard-section activities-section">
          <div className="section-header">
            <div className="section-title">
              <Icon name="clock" />
              <h3>Recent Activities</h3>
            </div>
          </div>
          <div className="activities-list">
            {recentActivities.length === 0 ? (
              <div className="empty-state">
                <Icon name="file-text" />
                <p>No recent activities</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="activity-card"
                  onClick={() => activity.link && (window.location.href = activity.link)}
                  style={{ cursor: activity.link ? 'pointer' : 'default' }}
                >
                  <div className="activity-icon">
                    <Icon name={getActivityIcon(activity.type)} />
                  </div>
                  <div className="activity-content">
                    <h4>{activity.title}</h4>
                    <p>{activity.description}</p>
                    <div className="activity-meta">
                      <span className="activity-date">{formatDate(activity.date)}</span>
                      {activity.status && (
                        <span className={`activity-status status-${activity.status}`}>
                          {activity.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* User Login Information Section */}
        {userLoginInfo && (
          <div className="dashboard-section user-info-section">
            <div className="section-header">
              <div className="section-title">
                <Icon name="users" />
                <h3>User Information</h3>
              </div>
            </div>
            <div className="user-info-card">
              <div className="user-info-item">
                <span className="info-label">Name:</span>
                <span className="info-value">{userLoginInfo.name}</span>
              </div>
              <div className="user-info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">{userLoginInfo.email}</span>
              </div>
              {userLoginInfo.employeeId && (
                <div className="user-info-item">
                  <span className="info-label">Employee ID:</span>
                  <span className="info-value">{userLoginInfo.employeeId}</span>
                </div>
              )}
              {userLoginInfo.department && (
                <div className="user-info-item">
                  <span className="info-label">Department:</span>
                  <span className="info-value">{userLoginInfo.department}</span>
                </div>
              )}
              <div className="user-info-item">
                <span className="info-label">Role:</span>
                <span className="info-value role-badge">{userLoginInfo.role}</span>
              </div>
              <div className="user-info-item">
                <span className="info-label">Last Login:</span>
                <span className="info-value">{formatDate(userLoginInfo.lastLogin)}</span>
              </div>
              {userLoginInfo.loginCount && (
                <div className="user-info-item">
                  <span className="info-label">Total Logins:</span>
                  <span className="info-value">{userLoginInfo.loginCount}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
