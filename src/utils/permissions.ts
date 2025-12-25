import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Permission levels for RBAC system
 * - full: Create, View, Edit, Delete, Approve (complete access)
 * - view: View only (read-only access, cannot create/edit/delete)
 * - partial: Only CREATE & SUBMIT own data (limited access)
 *   - Can access page and view data
 *   - Can CREATE and SUBMIT only their OWN data
 *   - CANNOT edit or delete data (even their own after submission)
 *   - CANNOT view admin controls, approvals, or manage other users' data
 *   - CANNOT access admin-only pages
 * - none: No access (page hidden and inaccessible)
 */
export type PermissionLevel = 'full' | 'view' | 'partial' | 'none';

/**
 * User roles in the system
 * - admin: Full access to all pages and actions
 * - employee: Access only to employee-related pages
 * - custom: Partial access based on explicit permissions
 */
export type UserRole = 'admin' | 'employee' | 'custom';

/**
 * Firestore permission structure
 * Stored in 'userRoles' collection with document ID = userId
 */
export interface UserPermissions {
  role: UserRole;
  permissions: {
    [pageName: string]: PermissionLevel;
  };
}

/**
 * Default permissions for each role
 * Used as fallback when user permissions are not explicitly set in Firestore
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Partial<Record<string, PermissionLevel>>> = {
  admin: {
    // Admin has full access to all pages (handled specially in code)
  },
  employee: {
    Dashboard: 'full',
    Profile: 'full',
    Documents: 'full',
    Complaints: 'partial',
    Requests: 'partial',
    Leave: 'partial',
  },
  custom: {
    // Custom users have no default permissions - must be explicitly set
  },
};

/**
 * Page name to route path mapping
 * Used to map page names to actual routes for permission checking
 */
export const PAGE_ROUTE_MAP: Record<string, string[]> = {
  Dashboard: ['/'],
  Profile: ['/profile'],
  Documents: ['/documents'],
  Staffs: ['/staffs', '/staffs/create', '/staffs/management', '/staffs/view/:id'],
  Leave: ['/leave', '/leave/request', '/leave/status'],
  Requests: ['/requests', '/requests/purchasing', '/requests/using'],
  Complaints: ['/complaints', '/complaints/registration', '/complaints/resolving'],
  Payrolls: ['/payrolls', '/payrolls/management', '/payrolls/settings', '/payrolls/overtime-calculation'],
  Overtime: ['/overtime'],
  Schedules: ['/schedules'],
  Settings: ['/settings'],
};

/**
 * Fetch user permissions from Firestore
 * @param uid - User ID from Firebase Auth
 * @returns UserPermissions object or null if not found
 */
export const fetchUserPermissions = async (uid: string): Promise<UserPermissions | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'userRoles', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        role: (data.role || 'employee') as UserRole,
        permissions: data.permissions || {},
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return null;
  }
};

/**
 * Check if user is admin
 * @param role - User role
 * @returns true if user is admin
 */
export const isAdmin = (role: UserRole | string): boolean => {
  if (!role) return false;
  const roleLower = role.toLowerCase();
  return roleLower === 'admin' || roleLower === 'administrator';
};

/**
 * Get permission level for a specific page
 * @param userPermissions - User's permissions object
 * @param pageName - Name of the page to check
 * @returns PermissionLevel for the page
 */
export const getPagePermission = (
  userPermissions: UserPermissions | null,
  pageName: string
): PermissionLevel => {
  // Admin always has full access to all pages
  if (userPermissions && isAdmin(userPermissions.role)) {
    return 'full';
  }

  if (!userPermissions) {
    return 'none';
  }

  // Settings page: admins always have access, others need explicit permission
  if (pageName === 'Settings') {
    if (isAdmin(userPermissions.role)) {
      return 'full';
    }
    // Check if Settings permission is explicitly set
    if (userPermissions.permissions[pageName] !== undefined) {
      return userPermissions.permissions[pageName];
    }
    // Default to none for non-admins
    return 'none';
  }

  // Check explicit permissions
  if (userPermissions.permissions[pageName] !== undefined) {
    return userPermissions.permissions[pageName];
  }

  // Check default role permissions
  const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[userPermissions.role];
  if (defaultPermissions && defaultPermissions[pageName] !== undefined) {
    return defaultPermissions[pageName]!;
  }

  // Default to none for security
  return 'none';
};

/**
 * Check if user can access a page (permission is not 'none')
 * @param userPermissions - User's permissions object
 * @param pageName - Name of the page to check
 * @returns true if user can access the page
 */
export const canAccessPage = (
  userPermissions: UserPermissions | null,
  pageName: string
): boolean => {
  const permission = getPagePermission(userPermissions, pageName);
  return permission !== 'none';
};

/**
 * Check if user can create/edit/delete data on a page
 * @param userPermissions - User's permissions object
 * @param pageName - Name of the page to check
 * @returns true if user has full access
 */
export const canManagePage = (
  userPermissions: UserPermissions | null,
  pageName: string
): boolean => {
  const permission = getPagePermission(userPermissions, pageName);
  return permission === 'full';
};

/**
 * Check if user can view data on a page (read-only)
 * Note: Partial access users can view the page to see their own data
 * @param userPermissions - User's permissions object
 * @param pageName - Name of the page to check
 * @returns true if user has view, partial, or full access
 */
export const canViewPage = (
  userPermissions: UserPermissions | null,
  pageName: string
): boolean => {
  const permission = getPagePermission(userPermissions, pageName);
  return permission === 'view' || permission === 'partial' || permission === 'full';
};

/**
 * Check if user can create/submit their own data on a page
 * Partial access users can only create/submit their OWN data
 * @param userPermissions - User's permissions object
 * @param pageName - Name of the page to check
 * @returns true if user has partial or full access
 */
export const canSubmitOwnData = (
  userPermissions: UserPermissions | null,
  pageName: string
): boolean => {
  const permission = getPagePermission(userPermissions, pageName);
  return permission === 'partial' || permission === 'full';
};

/**
 * Check if user has partial access (can only create/submit own data, cannot edit/delete)
 * @param userPermissions - User's permissions object
 * @param pageName - Name of the page to check
 * @returns true if user has partial access
 */
export const hasPartialAccess = (
  userPermissions: UserPermissions | null,
  pageName: string
): boolean => {
  const permission = getPagePermission(userPermissions, pageName);
  return permission === 'partial';
};

/**
 * Check if user can edit or delete data (including other users' data)
 * Partial access users CANNOT edit/delete (even their own after submission)
 * Only full access users can edit/delete
 * @param userPermissions - User's permissions object
 * @param pageName - Name of the page to check
 * @returns true if user has full access (can edit/delete)
 */
export const canEditOrDelete = (
  userPermissions: UserPermissions | null,
  pageName: string
): boolean => {
  const permission = getPagePermission(userPermissions, pageName);
  return permission === 'full';
};

/**
 * Check if user can approve or manage other users' data (admin actions)
 * Partial access users CANNOT see or use admin controls
 * Only full access users can approve/manage others' data
 * @param userPermissions - User's permissions object
 * @param pageName - Name of the page to check
 * @returns true if user has full access
 */
export const canApproveOrManageOthers = (
  userPermissions: UserPermissions | null,
  pageName: string
): boolean => {
  const permission = getPagePermission(userPermissions, pageName);
  return permission === 'full';
};

/**
 * Find page name from route path
 * @param path - Route path (e.g., '/staffs/create')
 * @returns Page name or null if not found
 */
export const getPageNameFromPath = (path: string): string | null => {
  // Normalize path: remove leading/trailing slashes and handle root
  const normalizedPath = path === '/' ? '/' : path.replace(/^\/+|\/+$/g, '');
  
  // Handle root path separately
  if (normalizedPath === '/') {
    return 'Dashboard';
  }

  // Get the first segment of the path
  const pathSegments = normalizedPath.split('/');
  const baseSegment = pathSegments[0];

  // Create a reverse mapping: base segment -> page name
  const segmentToPageMap: Record<string, string> = {
    '': 'Dashboard',
    'staffs': 'Staffs',
    'leave': 'Leave',
    'requests': 'Requests',
    'complaints': 'Complaints',
    'payrolls': 'Payrolls',
    'overtime': 'Overtime',
    'schedules': 'Schedules',
    'settings': 'Settings',
    'profile': 'Profile',
    'documents': 'Documents',
  };

  // Return the page name if found, otherwise null
  return segmentToPageMap[baseSegment] || null;
};

/**
 * Get all accessible pages for a user
 * @param userPermissions - User's permissions object
 * @returns Array of page names user can access
 */
export const getAccessiblePages = (userPermissions: UserPermissions | null): string[] => {
  if (!userPermissions) {
    return [];
  }

  // Admin can access all pages
  if (isAdmin(userPermissions.role)) {
    return Object.keys(PAGE_ROUTE_MAP);
  }

  // Get all pages user has permission for
  const accessiblePages: string[] = [];
  const allPages = Object.keys(PAGE_ROUTE_MAP);

  for (const pageName of allPages) {
    if (canAccessPage(userPermissions, pageName)) {
      accessiblePages.push(pageName);
    }
  }

  return accessiblePages;
};

