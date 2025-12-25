import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isAdmin as checkIsAdmin, fetchUserPermissions } from './permissions';
import type { UserRole } from './permissions';

/**
 * Legacy PermissionLevel type for backward compatibility
 * @deprecated Use PermissionLevel from './permissions' instead
 */
export type PermissionLevel = 'view' | 'edit' | 'not_access';

/**
 * Legacy RolePermission interface for backward compatibility
 * @deprecated Use UserPermissions from './permissions' instead
 */
export interface RolePermission {
  role: string;
  pages: {
    [pageName: string]: PermissionLevel | boolean;
  };
}

/**
 * Fetch user role from Firestore
 * Uses the new permission system but returns just the role string
 * @param uid - User ID from Firebase Auth
 * @returns User role string ('admin', 'employee', or 'custom')
 */
export const fetchUserRole = async (uid: string): Promise<string> => {
  try {
    // Use new permission system to fetch role
    const userPermissions = await fetchUserPermissions(uid);
    if (userPermissions) {
      return userPermissions.role;
    }

    // Fallback: Try legacy userRoles collection structure
    const userRoleDoc = await getDoc(doc(db, 'userRoles', uid));
    if (userRoleDoc.exists()) {
      const role = userRoleDoc.data().role;
      if (role) return role;
    }

    // Fallback: check employees collection
    const employeeDoc = await getDoc(doc(db, 'employees', uid));
    if (employeeDoc.exists()) {
      const role = employeeDoc.data().role || '';
      if (role) return role;
    }

    // Fallback: check staffs collection by authUserId
    const staffQuery = query(collection(db, 'staffs'), where('authUserId', '==', uid));
    const staffSnapshot = await getDocs(staffQuery);
    if (!staffSnapshot.empty) {
      const role = staffSnapshot.docs[0].data().role || '';
      if (role) return role;
    }

    // Default to employee if nothing found
    return 'employee';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return 'employee';
  }
};

/**
 * Check if user is admin
 * Re-exports from permissions module for backward compatibility
 * @param role - User role
 * @returns true if user is admin
 */
export const isAdmin = (role: string | UserRole): boolean => {
  return checkIsAdmin(role);
};

/**
 * Legacy function for checking edit permissions
 * @deprecated Use canManagePage from './permissions' instead
 */
export const canEditPage = async (pageName: string, userRole: string): Promise<boolean> => {
  try {
    // Admin users can always edit
    if (isAdmin(userRole)) {
      return true;
    }

    // Fetch role permissions from legacy collection
    const rolePermissionDoc = await getDoc(doc(db, 'rolePermissions', userRole));
    if (rolePermissionDoc.exists()) {
      const rolePermission = rolePermissionDoc.data() as RolePermission;
      const permission = getPermissionLevel(rolePermission.pages[pageName]);
      return permission === 'edit';
    }

    // Default to true if no permission found (backward compatibility)
    return true;
  } catch (error) {
    console.error('Error checking edit permission:', error);
    return false;
  }
};

/**
 * Legacy helper function for converting permissions
 * @deprecated
 */
const getPermissionLevel = (permission: PermissionLevel | boolean | undefined): PermissionLevel => {
  if (permission === undefined || permission === null) {
    return 'edit'; // Default to edit
  }
  if (typeof permission === 'boolean') {
    return permission ? 'edit' : 'not_access';
  }
  return permission;
};

/**
 * Legacy function for checking edit permissions synchronously
 * @deprecated Use canManagePage from './permissions' with PermissionContext instead
 */
export const canEditPageSync = (pageName: string, userRole: string, rolePermissions: RolePermission[]): boolean => {
  try {
    // Admin users can always edit
    if (isAdmin(userRole)) {
      return true;
    }

    // Check role permissions
    const rolePermission = rolePermissions.find(rp => rp.role === userRole);
    if (rolePermission) {
      const permission = getPermissionLevel(rolePermission.pages[pageName]);
      return permission === 'edit';
    }

    // Default to true if no permission found (backward compatibility)
    return true;
  } catch (error) {
    console.error('Error checking edit permission:', error);
    return false;
  }
};

