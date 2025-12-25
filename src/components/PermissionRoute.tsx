import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { fetchUserPermissions, getPageNameFromPath, canAccessPage } from '../utils/permissions';
import AccessDenied from '../pages/AccessDenied';

interface PermissionRouteProps {
  children: ReactNode;
  pageName?: string; // Optional page name, will be inferred from path if not provided
}

/**
 * Route guard component that checks user permissions before rendering routes
 * Shows Access Denied page if user doesn't have required permissions
 */
const PermissionRoute = ({ children, pageName }: PermissionRouteProps) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // This component is used within ProtectedRoute, so user is guaranteed to be authenticated
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // This shouldn't happen if used correctly within ProtectedRoute
        setHasAccess(false);
        setLoading(false);
        return;
      }

      try {
        // Fetch user permissions
        const userPermissions = await fetchUserPermissions(user.uid);

        // Determine page name from route path if not provided
        const currentPageName = pageName || getPageNameFromPath(location.pathname);

        if (currentPageName) {
          // Check if user has access to this page
          const access = canAccessPage(userPermissions, currentPageName);
          setHasAccess(access);
        } else {
          // If page name cannot be determined, allow access (for backward compatibility)
          // This handles routes that may not be in the permission system yet
          console.warn(`Could not determine page name for path: ${location.pathname}`);
          setHasAccess(true);
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasAccess(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [location.pathname, pageName]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh',
          background: '#f5f7fa',
        }}
      >
        <div style={{ color: '#1f2937', fontSize: '1.2rem' }}>Checking permissions...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

export default PermissionRoute;

