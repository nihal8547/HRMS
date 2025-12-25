import type { ReactNode } from 'react';
import { usePermissions } from '../contexts/PermissionContext';

interface PermissionGuardProps {
  pageName: string;
  permission: 'access' | 'view' | 'manage' | 'submit' | 'editDelete' | 'approve';
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * @example
 * // Only show button if user can manage (full access)
 * <PermissionGuard pageName="Staffs" permission="manage">
 *   <button>Create Staff</button>
 * </PermissionGuard>
 * 
 * @example
 * // Show read-only message if user can only view
 * <PermissionGuard pageName="Payrolls" permission="view" fallback={<p>Read-only access</p>}>
 *   <button>Edit Payroll</button>
 * </PermissionGuard>
 */
const PermissionGuard = ({ 
  pageName, 
  permission, 
  fallback = null, 
  children, 
}: PermissionGuardProps) => {
  const { 
    canAccessPage, 
    canViewPage, 
    canManagePage, 
    canSubmitOwnData,
    canEditOrDelete,
    canApproveOrManageOthers,
  } = usePermissions();

  let hasPermission = false;

  switch (permission) {
    case 'access':
      hasPermission = canAccessPage(pageName);
      break;
    case 'view':
      // View, partial, and full access users can view
      hasPermission = canViewPage(pageName);
      break;
    case 'manage':
      // Only full access users can manage
      hasPermission = canManagePage(pageName);
      break;
    case 'submit':
      // Partial and full access users can submit their own data
      hasPermission = canSubmitOwnData(pageName);
      break;
    case 'editDelete':
      // Only full access users can edit/delete (partial users cannot, even their own data)
      hasPermission = canEditOrDelete(pageName);
      break;
    case 'approve':
      // Only full access users can approve (admin actions)
      hasPermission = canApproveOrManageOthers(pageName);
      break;
    default:
      hasPermission = false;
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;

