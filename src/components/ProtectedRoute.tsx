import { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import ProfileCompletion from '../pages/ProfileCompletion';
import LoadingModal from './LoadingModal';

const ProtectedRoute = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        
        // Check if profile is completed
        try {
          const profileDoc = await getDoc(doc(db, 'employees', user.uid));
          
          // If document does NOT exist OR profileCompleted is false
          const profileData = profileDoc.exists() ? profileDoc.data() : null;
          const isProfileCompleted = profileData?.profileCompleted === true;
          
          console.log('ProtectedRoute - Profile status:', {
            exists: profileDoc.exists(),
            profileCompleted: isProfileCompleted,
            data: profileData
          });
          
          if (!profileDoc.exists() || !isProfileCompleted) {
            // Profile not completed, show profile completion page
            console.log('Showing profile completion page');
            setShowProfileCompletion(true);
          } else {
            // Profile completed, show normal content (Dashboard)
            console.log('Profile completed - Showing dashboard and main interfaces');
            setShowProfileCompletion(false);
          }
        } catch (error) {
          console.error('Error checking profile:', error);
          // On error, show profile completion to be safe
          setShowProfileCompletion(true);
        }
      } else {
        // Not authenticated, redirect to login
        setIsAuthenticated(false);
        setShowProfileCompletion(false);
        navigate('/login', { replace: true });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return <LoadingModal isLoading={true} message="Loading..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (showProfileCompletion) {
    return <ProfileCompletion />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

