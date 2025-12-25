import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { fetchUserPermissions, canAccessPage } from '../utils/permissions';
import Icon from './Icons';
import BottomNav from './BottomNav';
import FooterInfoTooltip from './FooterInfoTooltip';
import './Layout.css';

const SidebarHeader = () => {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="sidebar-header">
      {!logoError && (
        <img 
          src="/logo.png" 
          alt="HRMS Logo" 
          className="sidebar-logo" 
          onError={() => setLogoError(true)}
        />
      )}
      <h2>HRMS</h2>
    </div>
  );
};

interface MenuSection {
  title: string;
  items: {
    path: string;
    label: string;
    icon: string;
    pageName?: string;
  }[];
}

const Layout = () => {
  const [sidebarOpen] = useState(true);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const allMenuSections: MenuSection[] = [
    {
      title: 'Main',
      items: [
        { path: '/', label: 'Dashboard', icon: 'grid', pageName: 'Dashboard' },
        { path: '/profile', label: 'My Profile', icon: 'users', pageName: 'Profile' },
        { path: '/documents', label: 'Documents', icon: 'file-text', pageName: 'Documents' }
      ]
    },
    {
      title: 'Management',
      items: [
        { path: '/staffs', label: 'Staffs', icon: 'users', pageName: 'Staffs' },
        { path: '/leave', label: 'Leave', icon: 'calendar', pageName: 'Leave' },
        { path: '/requests', label: 'Requests', icon: 'file-text', pageName: 'Requests' },
        { path: '/complaints', label: 'Complaints', icon: 'alert-circle', pageName: 'Complaints' },
        { path: '/schedules', label: 'Schedules', icon: 'clock', pageName: 'Schedules' }
      ]
    },
    {
      title: 'HR Management',
      items: [
        { path: '/payrolls', label: 'Payrolls', icon: 'dollar-sign', pageName: 'Payrolls' },
        { path: '/overtime', label: 'Overtime', icon: 'clock', pageName: 'Overtime' },
        { path: '/settings', label: 'Settings', icon: 'settings', pageName: 'Settings' }
      ]
    }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const permissions = await fetchUserPermissions(user.uid);
          setUserPermissions(permissions);
        } catch (error) {
          console.error('Error fetching user permissions:', error);
          setUserPermissions(null);
        }
      } else {
        setUserPermissions(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Check if user can access a page (permission is not 'none')
   * Uses the new RBAC permission system
   */
  const isPageAccessible = useCallback(
    (pageName: string): boolean => {
      // Settings page is always accessible (needed to configure permissions)
      // Note: Settings should still be restricted in route guard, but shown in sidebar for admins
      if (pageName === 'Settings' && userPermissions?.role === 'admin') {
        return true;
      }

      // If permissions not loaded yet, don't show page (wait for permissions to load)
      if (loading || !userPermissions) {
        return false;
      }

      // Use new permission system to check access
      return canAccessPage(userPermissions, pageName);
    },
    [userPermissions, loading]
  );

  /**
   * Filter menu sections based on user permissions
   * Pages with 'none' permission are hidden from sidebar
   * Use useMemo to recalculate when permissions change
   */
  const menuSections = useMemo(() => {
    if (loading) {
      return []; // Don't show menu while loading permissions
    }

    return allMenuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const pageName = item.pageName;
          // If pageName is provided, check permissions; otherwise always show
          return pageName ? isPageAccessible(pageName) : true;
        }),
      }))
      .filter((section) => section.items.length > 0); // Remove empty sections
  }, [isPageAccessible, loading]);

  /**
   * Get bottom navigation items for mobile
   * Shows ALL accessible pages with shorter labels
   */
  const bottomNavItems = useMemo(() => {
    if (loading) {
      return [];
    }

    // Flatten all menu sections and filter by permissions
    const allItems = allMenuSections.flatMap((section) => section.items);
    const accessibleItems = allItems.filter((item) => {
      const pageName = item.pageName;
      return pageName ? isPageAccessible(pageName) : true;
    });

    // Map items to shorter labels and appropriate icons for mobile
    return accessibleItems.map((item) => ({
      ...item,
      label: item.path === '/' ? 'Home' : 
             item.path === '/profile' ? 'Profile' :
             item.path === '/staffs' ? 'Staffs' :
             item.path === '/leave' ? 'Leave' :
             item.path === '/requests' ? 'Requests' :
             item.path === '/complaints' ? 'Complaints' :
             item.path === '/schedules' ? 'Schedules' :
             item.path === '/payrolls' ? 'Payrolls' :
             item.path === '/overtime' ? 'Overtime' :
             item.path === '/documents' ? 'Documents' :
             item.path === '/settings' ? 'Settings' :
             item.label.length > 10 ? item.label.substring(0, 10) : item.label, // Truncate long labels
      icon: item.path === '/' ? 'home' : item.icon // Use home icon for Dashboard
    }));
  }, [isPageAccessible, loading, allMenuSections]);

  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      // Still navigate to login even if there's an error
      navigate('/login');
    }
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <SidebarHeader />
        <nav className="sidebar-nav">
          {menuSections.map((section, sectionIndex) => {
            return (
              <div key={section.title} className="nav-section">
                {sectionIndex > 0 && <div className="section-divider"></div>}
                <div className="section-items">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                    >
                      <span className="nav-icon">
                        <Icon name={item.icon} />
                      </span>
                      {sidebarOpen && <span className="nav-label">{item.label}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="section-divider"></div>
          <div className="logout-section">
            <button className="logout-btn" onClick={handleLogout}>
              <span className="nav-icon">
                <Icon name="logout" />
              </span>
              {sidebarOpen && <span className="nav-label">Logout</span>}
            </button>
          </div>
        </nav>
      </aside>
      <main className="main-content">
        <header className="top-header">
          <h1>Medical Staff Management System</h1>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
      <BottomNav items={bottomNavItems} />
      <FooterInfoTooltip />
    </div>
  );
};

export default Layout;

