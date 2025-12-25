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
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        try {
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
            } catch (statusError: any) {
              console.error('Error checking user status:', statusError);
              // If it's a Firebase API error (400), log but continue
              if (statusError?.code?.includes('auth/') || statusError?.message?.includes('400')) {
                console.warn('Firebase API error detected, continuing with authentication...');
              }
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
            } catch (error: any) {
              console.error('Error checking profile:', error);
              // If it's a Firebase API error (400), log but continue
              if (error?.code?.includes('auth/') || error?.message?.includes('400')) {
                console.warn('Firebase API error detected, showing profile completion as fallback...');
              }
              // On error, show profile completion to be safe
              setShowProfileCompletion(true);
            }
          } else {
            // Not authenticated, redirect to login
            setIsAuthenticated(false);
            setShowProfileCompletion(false);
            navigate('/login', { replace: true });
          }
        } catch (error: any) {
          // Catch any unexpected errors in the auth state change handler
          console.error('Unexpected error in auth state change:', error);
          // If it's a Firebase API error (400), try to continue
          if (error?.code?.includes('auth/') || error?.message?.includes('400')) {
            console.warn('Firebase API error (400) detected. This may be due to API key restrictions.');
            console.warn('Please check your Firebase project configuration and API key restrictions.');
            // Try to continue if user exists
            if (user) {
              setIsAuthenticated(true);
              setShowProfileCompletion(true);
            }
          }
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        // Error callback for onAuthStateChanged
        console.error('Firebase Auth state change error:', error);
        // If it's a 400 error, it's likely an API key issue
        if (error?.code?.includes('auth/') || error?.message?.includes('400')) {
          console.warn('Firebase API error (400) - This may indicate:');
          console.warn('1. API key restrictions in Firebase Console');
          console.warn('2. Invalid or expired API key');
          console.warn('3. Firebase project configuration issues');
          console.warn('Please check your Firebase project settings.');
        }
        setLoading(false);
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
    );

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

