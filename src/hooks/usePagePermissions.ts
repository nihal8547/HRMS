import { usePermissions } from '../contexts/PermissionContext';

/**
 * Custom hook for checking page-specific permissions
 * Provides convenience methods for common permission checks
 * 
 * @param pageName - Name of the page to check permissions for
 * @returns Object with permission check methods
 * 
 * @example
 * const { canManage, canView, canSubmit, canAccess } = usePagePermissions('Staffs');
 * 
 * {canManage && <button>Create Staff</button>}
 * {canView && <Table data={staffData} />}
 */
export const usePagePermissions = (pageName: string) => {
  const {
    canAccessPage,
    canViewPage,
    canManagePage,
    canSubmitOwnData,
    hasPartialAccess,
    canEditOrDelete,
    canApproveOrManageOthers,
    getPagePermission,
  } = usePermissions();

  return {
    /**
     * Check if user can access the page (permission is not 'none')
     */
    canAccess: canAccessPage(pageName),
    
    /**
     * Check if user can view the page (read-only, partial, or full access)
     */
    canView: canViewPage(pageName),
    
    /**
     * Check if user can manage the page (create, edit, delete - full access only)
     */
    canManage: canManagePage(pageName),
    
    /**
     * Check if user can submit their own data (partial or full access)
     * Partial access users can only create/submit their OWN data
     */
    canSubmit: canSubmitOwnData(pageName),
    
    /**
     * Check if user has partial access (can only create/submit own data, cannot edit/delete)
     */
    isPartialAccess: hasPartialAccess(pageName),
    
    /**
     * Check if user can edit or delete data (including their own after submission)
     * Partial access users CANNOT edit/delete
     * Only full access users can edit/delete
     */
    canEditDelete: canEditOrDelete(pageName),
    
    /**
     * Check if user can approve or manage other users' data (admin actions)
     * Partial access users CANNOT see or use admin controls
     * Only full access users can approve/manage others' data
     */
    canApprove: canApproveOrManageOthers(pageName),
    
    /**
     * Get the permission level for the page ('full', 'view', 'partial', or 'none')
     */
    permission: getPagePermission(pageName),
  };
};

