import { Link } from 'react-router-dom';
import Icon from '../components/Icons';
import './AccessDenied.css';

const AccessDenied = () => {
  return (
    <div className="access-denied-container">
      <div className="access-denied-content">
        <div className="access-denied-icon">
          <Icon name="lock" />
        </div>
        <h1 className="access-denied-title">Access Denied</h1>
        <p className="access-denied-message">
          You don't have permission to access this page.
        </p>
        <p className="access-denied-submessage">
          If you believe this is an error, please contact your administrator.
        </p>
        <div className="access-denied-actions">
          <Link to="/" className="access-denied-button">
            <Icon name="home" />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;

