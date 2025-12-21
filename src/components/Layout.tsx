import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icons';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuSection {
  title: string;
  items: {
    path: string;
    label: string;
    icon: string;
  }[];
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const menuSections: MenuSection[] = [
    {
      title: 'Main',
      items: [
        { path: '/', label: 'Dashboard', icon: 'grid' }
      ]
    },
    {
      title: 'Management',
      items: [
        { path: '/staffs', label: 'Staffs', icon: 'users' },
        { path: '/leave', label: 'Leave', icon: 'calendar' },
        { path: '/requests', label: 'Requests', icon: 'file-text' },
        { path: '/complaints', label: 'Complaints', icon: 'alert-circle' },
        { path: '/schedules', label: 'Schedules', icon: 'clock' }
      ]
    },
    {
      title: 'HR Management',
      items: [
        { path: '/payrolls', label: 'Payrolls', icon: 'dollar-sign' },
        { path: '/overtime', label: 'Overtime', icon: 'clock' },
        { path: '/settings', label: 'Settings', icon: 'settings' }
      ]
    }
  ];

  const getSectionKey = (title: string): string => {
    const keyMap: { [key: string]: string } = {
      'Main': 'main',
      'Management': 'management',
      'HR Management': 'hr'
    };
    return keyMap[title] || title.toLowerCase().replace(/\s+/g, '');
  };

  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    main: true,
    management: true,
    hr: true
  });
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>HRMS</h2>
        </div>
        <nav className="sidebar-nav">
          {menuSections.map((section, sectionIndex) => {
            const sectionKey = getSectionKey(section.title);
            const isExpanded = expandedSections[sectionKey] ?? true;
            
            return (
              <div key={section.title} className="nav-section">
                {sectionIndex > 0 && <div className="section-divider"></div>}
                <div 
                  className="section-header"
                  onClick={() => toggleSection(sectionKey)}
                >
                  <span className="section-title">{section.title}</span>
                  {sidebarOpen && (
                    <span className={`section-caret ${isExpanded ? 'expanded' : ''}`}>
                      ▲
                    </span>
                  )}
                </div>
                {isExpanded && (
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
                )}
              </div>
            );
          })}
          <div className="section-divider"></div>
          <div className="logout-section">
            <button className="logout-btn">
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
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

