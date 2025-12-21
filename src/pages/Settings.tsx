import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Icon from '../components/Icons';
import './Settings.css';

interface PageControl {
  id: string;
  pageName: string;
  enabled: boolean;
  description: string;
  path: string;
  icon: string;
}

const Settings = () => {
  const [pageControls, setPageControls] = useState<PageControl[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const defaultPages = [
    { pageName: 'Dashboard', enabled: true, description: 'Main dashboard page', path: '/', icon: '📊' },
    { pageName: 'Staffs', enabled: true, description: 'Staff management pages', path: '/staffs', icon: '👥' },
    { pageName: 'Leave', enabled: true, description: 'Leave request and management', path: '/leave', icon: '🏖️' },
    { pageName: 'Requests', enabled: true, description: 'Item purchasing and using requests', path: '/requests', icon: '📋' },
    { pageName: 'Complaints', enabled: true, description: 'Complaint registration and resolving', path: '/complaints', icon: '📢' },
    { pageName: 'Payrolls', enabled: true, description: 'Payroll settings and calculations', path: '/payrolls', icon: '💰' },
    { pageName: 'Overtime', enabled: true, description: 'Overtime submission', path: '/overtime', icon: '⏰' },
    { pageName: 'Schedules', enabled: true, description: 'Duty time scheduling', path: '/schedules', icon: '📅' },
    { pageName: 'Settings', enabled: true, description: 'System settings', path: '/settings', icon: '⚙️' }
  ];

  useEffect(() => {
    fetchPageControls();
  }, []);

  const fetchPageControls = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'pageControls'));
      if (!snapshot.empty) {
        const controls = snapshot.docs.map(doc => {
          const data = doc.data();
          // Merge with default page data if properties are missing
          const defaultPage = defaultPages.find(p => p.pageName === data.pageName);
          return {
            id: doc.id,
            ...defaultPage,
            ...data
          };
        }) as PageControl[];
        setPageControls(controls);
      } else {
        // Initialize with default pages
        const initialControls = await Promise.all(
          defaultPages.map(async (page) => {
            const docRef = await addDoc(collection(db, 'pageControls'), page);
            return { id: docRef.id, ...page };
          })
        );
        setPageControls(initialControls);
      }
    } catch (error) {
      console.error('Error fetching page controls:', error);
      // Fallback to default pages
      setPageControls(defaultPages.map((page, index) => ({ id: `default-${index}`, ...page })));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'pageControls', id), {
        enabled: !enabled,
        updatedAt: new Date()
      });
      setPageControls(prev =>
        prev.map(control =>
          control.id === id ? { ...control, enabled: !enabled } : control
        )
      );
    } catch (error) {
      console.error('Error updating page control:', error);
    }
  };

  const handlePageClick = (path: string, enabled: boolean) => {
    if (enabled) {
      navigate(path);
    }
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="settings-page">
      <h2>Page Settings & Control</h2>
      <div className="settings-container">
        <div className="pages-grid">
          {pageControls.map((control) => (
            <div key={control.id} className={`page-card ${!control.enabled ? 'disabled' : ''}`}>
              <div className="page-card-header">
                <div className="page-icon">{control.icon}</div>
                <div className="page-info">
                  <h3>{control.pageName}</h3>
                  <p>{control.description}</p>
                </div>
              </div>
              <div className="page-card-actions">
                <button
                  className={`page-button ${control.enabled ? 'enabled' : 'disabled'}`}
                  onClick={() => handlePageClick(control.path, control.enabled)}
                  disabled={!control.enabled}
                >
                  {control.enabled ? 'Open Page' : 'Page Disabled'}
                </button>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={control.enabled}
                    onChange={() => handleToggle(control.id, control.enabled)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="settings-note">
          <p><strong>Note:</strong> Click "Open Page" button to navigate to the page. Use the toggle switch to enable/disable pages from the navigation menu.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;

