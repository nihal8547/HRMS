import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  fetchUserPermissions,
  getPagePermission,
  canAccessPage as checkCanAccessPage,
  canManagePage as checkCanManagePage,
  canViewPage as checkCanViewPage,
  canSubmitOwnData as checkCanSubmitOwnData,
  hasPartialAccess as checkHasPartialAccess,
  canEditOrDelete as checkCanEditOrDelete,
  canApproveOrManageOthers as checkCanApproveOrManageOthers,
} from '../utils/permissions';
import type { UserPermissions, PermissionLevel } from '../utils/permissions';

interface PermissionContextType {
  userPermissions: UserPermissions | null;
  loading: boolean;
  getPagePermission: (pageName: string) => PermissionLevel;
  canAccessPage: (pageName: string) => boolean;
  canManagePage: (pageName: string) => boolean;
  canViewPage: (pageName: string) => boolean;
  canSubmitOwnData: (pageName: string) => boolean;
  hasPartialAccess: (pageName: string) => boolean;
  canEditOrDelete: (pageName: string) => boolean;
  canApproveOrManageOthers: (pageName: string) => boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

interface PermissionProviderProps {
  children: ReactNode;
}

export const PermissionProvider = ({ children }: PermissionProviderProps) => {
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const permissions = await fetchUserPermissions(user.uid);
          setUserPermissions(permissions);
        } catch (error) {
          console.error('Error loading permissions:', error);
          setUserPermissions(null);
        }
      } else {
        setUserPermissions(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value: PermissionContextType = {
    userPermissions,
    loading,
    getPagePermission: (pageName: string) => getPagePermission(userPermissions, pageName),
    canAccessPage: (pageName: string) => checkCanAccessPage(userPermissions, pageName),
    canManagePage: (pageName: string) => checkCanManagePage(userPermissions, pageName),
    canViewPage: (pageName: string) => checkCanViewPage(userPermissions, pageName),
    canSubmitOwnData: (pageName: string) => checkCanSubmitOwnData(userPermissions, pageName),
    hasPartialAccess: (pageName: string) => checkHasPartialAccess(userPermissions, pageName),
    canEditOrDelete: (pageName: string) => checkCanEditOrDelete(userPermissions, pageName),
    canApproveOrManageOthers: (pageName: string) => checkCanApproveOrManageOthers(userPermissions, pageName),
  };

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

