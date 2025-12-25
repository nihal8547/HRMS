import { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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
        // Check user status first - inactive users should not access the app
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
          
          // If user is inactive, sign them out and redirect to login
          if (userStatus === 'inactive') {
            await signOut(auth);
            navigate('/login', { replace: true });
            setLoading(false);
            return;
          }
        } catch (statusError) {
          console.error('Error checking user status:', statusError);
          // If we can't check status, allow access but log the error
        }
        
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

