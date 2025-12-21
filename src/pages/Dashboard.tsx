import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import Icon from '../components/Icons';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStaffs: 0,
    pendingLeaves: 0,
    activeRequests: 0,
    unresolvedComplaints: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch staffs count
        const staffsSnapshot = await getDocs(collection(db, 'staffs'));
        setStats(prev => ({ ...prev, totalStaffs: staffsSnapshot.size }));

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
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: 'Total Staffs', value: stats.totalStaffs, icon: 'users', color: '#3b82f6' },
    { title: 'Pending Leaves', value: stats.pendingLeaves, icon: 'calendar', color: '#f59e0b' },
    { title: 'Active Requests', value: stats.activeRequests, icon: 'file-text', color: '#10b981' },
    { title: 'Unresolved Complaints', value: stats.unresolvedComplaints, icon: 'alert-circle', color: '#ef4444' }
  ];

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
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
      <div className="dashboard-content">
        <div className="dashboard-section">
          <h3>Recent Activities</h3>
          <p>No recent activities to display.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;







