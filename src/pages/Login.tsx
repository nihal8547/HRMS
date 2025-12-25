import { useState } from 'react';
import Icon from '../components/Icons';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check user status in employees and staffs collections
      try {
        // Check employees collection first
        const employeeDoc = await getDoc(doc(db, 'employees', user.uid));
        let userStatus = 'active';
        
        if (employeeDoc.exists()) {
          const employeeData = employeeDoc.data();
          userStatus = employeeData.status || 'active';
        } else {
          // Check staffs collection if not found in employees
          const staffDoc = await getDoc(doc(db, 'staffs', user.uid));
          if (staffDoc.exists()) {
            const staffData = staffDoc.data();
            userStatus = staffData.status || 'active';
          }
        }
        
        // Check if user is inactive
        if (userStatus === 'inactive') {
          // Sign out the user immediately
          await signOut(auth);
          setError('Your account is inactive. Please contact the administrator for assistance.');
          setLoading(false);
          return;
        }
        
        // User is active, proceed with navigation
        navigate('/', { replace: true });
      } catch (statusError) {
        console.error('Error checking user status:', statusError);
        // If we can't check status, allow login but log the error
      navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>HRMS</h1>
          <h2>Welcome Back</h2>
          <p>Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error">
              <Icon name="alert-circle" />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

