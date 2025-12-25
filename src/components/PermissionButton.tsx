import type { ReactNode } from 'react';
import { usePagePermissions } from '../hooks/usePagePermissions';

interface PermissionButtonProps {
  pageName: string;
  permission: 'manage' | 'submit' | 'view';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  tooltip?: string;
}

/**
 * Button component that automatically handles permission-based rendering
 * Shows disabled state with tooltip if user doesn't have required permission
 * 
 * @example
 * <PermissionButton 
 *   pageName="Staffs" 
 *   permission="manage"
 *   onClick={handleCreate}
 *   tooltip="You need full access to create staff"
 * >
 *   Create Staff
 * </PermissionButton>
 */
const PermissionButton = ({
  pageName,
  permission,
  onClick,
  disabled = false,
  className = '',
  children,
  tooltip,
}: PermissionButtonProps) => {
  const { canManage, canSubmit, canView } = usePagePermissions(pageName);

  let hasPermission = false;
  let defaultTooltip = '';

  switch (permission) {
    case 'manage':
      // Only full access users can manage (edit/delete/approve)
      hasPermission = canManage;
      defaultTooltip = 'You need full access to perform this action';
      break;
    case 'submit':
      // Partial and full access users can submit their own data
      hasPermission = canSubmit;
      defaultTooltip = 'You can only submit your own data';
      break;
    case 'view':
      // View, partial, and full access users can view
      hasPermission = canView;
      defaultTooltip = 'You need view access to perform this action';
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

export default PermissionButton;

