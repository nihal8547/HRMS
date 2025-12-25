import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import ProfileCompletion from '../pages/ProfileCompletion';

interface DashboardGuardProps {
  children: React.ReactNode;
}

/**
 * DashboardGuard component protects the Dashboard route
 * Ensures users with incomplete profiles are redirected to Profile Completion
 */
const DashboardGuard = ({ children }: DashboardGuardProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        
        try {
          const profileDoc = await getDoc(doc(db, 'employees', user.uid));
          
          // If document doesn't exist OR profileCompleted is false
          if (!profileDoc.exists() || profileDoc.data()?.profileCompleted !== true) {
            // Force redirect to profile completion
            setShowProfileCompletion(true);
          } else {
            // Profile is completed, show dashboard
            setShowProfileCompletion(false);
          }
        } catch (error) {
          console.error('Error checking profile in DashboardGuard:', error);
          // On error, redirect to profile completion to be safe
          setShowProfileCompletion(true);
        }
      } else {
        // Not authenticated, redirect to login
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f5f7fa'
      }}>
        <div style={{ color: '#1f2937', fontSize: '1.2rem' }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (showProfileCompletion) {
    return <ProfileCompletion />;
  }

  return <>{children}</>;
};

export default DashboardGuard;



















