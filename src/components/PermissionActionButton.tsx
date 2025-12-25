import type { ReactNode } from 'react';
import { usePagePermissions } from '../hooks/usePagePermissions';

interface PermissionActionButtonProps {
  pageName: string;
  action: 'create' | 'edit' | 'delete' | 'approve';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  tooltip?: string;
  /**
   * For partial access users: check if this is the user's own data
   * If true and user has partial access, allow the action
   * If false and user has partial access, disable the action
   */
  isOwnData?: boolean;
}

/**
 * Specialized button component for actions (Create, Edit, Delete, Approve)
 * Handles partial access restrictions:
 * - Partial access users can CREATE their own data
 * - Partial access users CANNOT EDIT or DELETE (even their own data after submission)
 * - Partial access users CANNOT APPROVE other users' data
 * 
 * @example
 * // Create button - partial access users can use this
 * <PermissionActionButton 
 *   pageName="Complaints" 
 *   action="create"
 *   onClick={handleCreate}
 * >
 *   Create Complaint
 * </PermissionActionButton>
 * 
 * @example
 * // Edit button - only full access users can use this
 * <PermissionActionButton 
 *   pageName="Complaints" 
 *   action="edit"
 *   onClick={handleEdit}
 *   isOwnData={complaint.employeeId === currentUserId}
 * >
 *   Edit
 * </PermissionActionButton>
 * 
 * @example
 * // Approve button - only full access users can use this
 * <PermissionActionButton 
 *   pageName="Leave" 
 *   action="approve"
 *   onClick={handleApprove}
 * >
 *   Approve
 * </PermissionActionButton>
 */
const PermissionActionButton = ({
  pageName,
  action,
  onClick,
  disabled = false,
  className = '',
  children,
  tooltip,
  isOwnData = false,
}: PermissionActionButtonProps) => {
  const { canManage, canSubmit, isPartialAccess, canEditDelete, canApprove } = usePagePermissions(pageName);

  let hasPermission = false;
  let defaultTooltip = '';

  switch (action) {
    case 'create':
      // Partial and full access users can create their own data
      hasPermission = canSubmit;
      defaultTooltip = isPartialAccess 
        ? 'You can only create your own data' 
        : 'You need permission to create';
      break;
    case 'edit':
      // Only full access users can edit (partial users cannot edit even their own data)
      hasPermission = canEditDelete;
      defaultTooltip = isPartialAccess
        ? 'You cannot edit data after submission. You can only create and submit your own data.'
        : 'You need full access to edit data';
      break;
    case 'delete':
      // Only full access users can delete (partial users cannot delete even their own data)
      hasPermission = canEditDelete;
      defaultTooltip = isPartialAccess
        ? 'You cannot delete data. You can only create and submit your own data.'
        : 'You need full access to delete data';
      break;
    case 'approve':
      // Only full access users can approve (admin action)
      hasPermission = canApprove;
      defaultTooltip = isPartialAccess
        ? 'You cannot approve requests. This is an admin-only action.'
        : 'You need full access to approve requests';
      break;
  }

  const isDisabled = disabled || !hasPermission;
  const displayTooltip = tooltip || (!hasPermission ? defaultTooltip : '');

  return (
    <button
      onClick={hasPermission ? onClick : undefined}
      disabled={isDisabled}
      className={className}
      title={displayTooltip}
      style={{
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
};

export default PermissionActionButton;







