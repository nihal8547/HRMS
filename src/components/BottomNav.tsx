import { Link, useLocation } from 'react-router-dom';
import Icon from './Icons';
import './BottomNav.css';

interface BottomNavItem {
  path: string;
  label: string;
  icon: string;
  pageName?: string;
}

interface BottomNavProps {
  items: BottomNavItem[];
}

/**
 * Mobile bottom navigation bar component
 * Displays main navigation items at the bottom of the screen on mobile devices
 */
const BottomNav = ({ items }: BottomNavProps) => {
  const location = useLocation();

  const isActive = (path: string) => {
    // Handle root path
    if (path === '/') {
      return location.pathname === '/';
    }
    // For other paths, check if current path starts with the item path
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item ${active ? 'active' : ''}`}
          >
            <div className="bottom-nav-icon">
              <Icon name={item.icon} />
            </div>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;

