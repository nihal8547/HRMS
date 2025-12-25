/**
 * Performance Optimization Utilities
 * Centralized functions to reduce redundant API calls
 */

import { fetchAllEmployees } from './fetchEmployees';
import { fetchUserRole } from './userRole';

// Cache for employee data
let employeesCache: any[] | null = null;
let employeesCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for user roles
const userRoleCache = new Map<string, { role: string; timestamp: number }>();
const ROLE_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

/**
 * Get employees with caching
 */
export const getCachedEmployees = async (): Promise<any[]> => {
  const now = Date.now();
  
  if (employeesCache && (now - employeesCacheTime) < CACHE_DURATION) {
    return employeesCache;
  }
  
  employeesCache = await fetchAllEmployees();
  employeesCacheTime = now;
  return employeesCache;
};

/**
 * Clear employees cache
 */
export const clearEmployeesCache = () => {
  employeesCache = null;
  employeesCacheTime = 0;
};

/**
 * Get user role with caching
 */
export const getCachedUserRole = async (uid: string): Promise<string> => {
  const cached = userRoleCache.get(uid);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < ROLE_CACHE_DURATION) {
    return cached.role;
  }
  
  const role = await fetchUserRole(uid);
  userRoleCache.set(uid, { role, timestamp: now });
  return role;
};

/**
 * Clear user role cache
 */
export const clearUserRoleCache = (uid?: string) => {
  if (uid) {
    userRoleCache.delete(uid);
  } else {
    userRoleCache.clear();
  }
};

