import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db } from '../firebase/config';

/**
 * Complete user data deletion utility
 * Deletes user data from:
 * - Firestore: employees collection
 * - Firestore: staffs collection
 * - Firestore: userRoles collection
 * - Firebase Authentication
 * 
 * @param userId - The user ID (UID) to delete
 * @param currentUser - The currently authenticated admin user (for authentication deletion)
 * @returns Promise<{ success: boolean; message: string; deletedFrom: string[] }>
 */
export const deleteUserData = async (
  userId: string,
  currentUser: any
): Promise<{ success: boolean; message: string; deletedFrom: string[] }> => {
  const deletedFrom: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Delete from employees collection
    try {
      const employeeDocRef = doc(db, 'employees', userId);
      await deleteDoc(employeeDocRef);
      deletedFrom.push('employees');
      console.log(`Deleted from employees collection: ${userId}`);
    } catch (error: any) {
      if (error.code !== 'not-found') {
        errors.push(`employees: ${error.message}`);
        console.error('Error deleting from employees:', error);
      }
    }

    // 2. Delete from staffs collection
    try {
      const staffDocRef = doc(db, 'staffs', userId);
      await deleteDoc(staffDocRef);
      deletedFrom.push('staffs');
      console.log(`Deleted from staffs collection: ${userId}`);
    } catch (error: any) {
      if (error.code !== 'not-found') {
        errors.push(`staffs: ${error.message}`);
        console.error('Error deleting from staffs:', error);
      }
    }

    // 3. Delete from userRoles collection
    try {
      const userRoleDocRef = doc(db, 'userRoles', userId);
      await deleteDoc(userRoleDocRef);
      deletedFrom.push('userRoles');
      console.log(`Deleted from userRoles collection: ${userId}`);
    } catch (error: any) {
      if (error.code !== 'not-found') {
        errors.push(`userRoles: ${error.message}`);
        console.error('Error deleting from userRoles:', error);
      }
    }

    // 4. Delete related documents by employeeId or authUserId
    try {
      // Find and delete documents in staffs collection by employeeId or authUserId
      const staffsQuery = query(
        collection(db, 'staffs'),
        where('authUserId', '==', userId)
      );
      const staffsSnapshot = await getDocs(staffsQuery);
      for (const docSnap of staffsSnapshot.docs) {
        await deleteDoc(doc(db, 'staffs', docSnap.id));
        deletedFrom.push(`staffs (by authUserId: ${docSnap.id})`);
      }

      // Find and delete documents in employees collection by employeeId
      const employeesQuery = query(
        collection(db, 'employees'),
        where('authUserId', '==', userId)
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      for (const docSnap of employeesSnapshot.docs) {
        await deleteDoc(doc(db, 'employees', docSnap.id));
        deletedFrom.push(`employees (by authUserId: ${docSnap.id})`);
      }
    } catch (error: any) {
      console.error('Error deleting related documents:', error);
      errors.push(`related documents: ${error.message}`);
    }

    // 5. Delete from Firebase Authentication
    // Note: This requires admin privileges or the user must be authenticated
    // For admin deletion, you may need to use Firebase Admin SDK on the backend
    // For now, we'll attempt to delete if the user is the current user
    try {
      if (currentUser && currentUser.uid === userId) {
        // User is deleting their own account
        await deleteUser(currentUser);
        deletedFrom.push('authentication');
        console.log(`Deleted from authentication: ${userId}`);
      } else {
        // Admin deleting another user - requires Admin SDK
        // For now, we'll log this and suggest using Firebase Console
        console.warn('Cannot delete another user from authentication using client SDK.');
        console.warn('Use Firebase Admin SDK or Firebase Console to delete user from authentication.');
        errors.push('authentication: Requires Admin SDK or Firebase Console');
      }
    } catch (error: any) {
      console.error('Error deleting from authentication:', error);
      errors.push(`authentication: ${error.message}`);
    }

    if (errors.length > 0) {
      return {
        success: deletedFrom.length > 0,
        message: `Partially deleted. Deleted from: ${deletedFrom.join(', ')}. Errors: ${errors.join('; ')}`,
        deletedFrom
      };
    }

    return {
      success: true,
      message: `Successfully deleted user data from: ${deletedFrom.join(', ')}`,
      deletedFrom
    };
  } catch (error: any) {
    console.error('Error in deleteUserData:', error);
    return {
      success: false,
      message: `Failed to delete user data: ${error.message}`,
      deletedFrom
    };
  }
};

/**
 * Delete user data using employeeId instead of userId
 * @param employeeId - The employee ID to find and delete
 * @param currentUser - The currently authenticated admin user
 */
export const deleteUserDataByEmployeeId = async (
  employeeId: string,
  currentUser: any
): Promise<{ success: boolean; message: string; deletedFrom: string[] }> => {
  try {
    // Find user by employeeId
    const employeesQuery = query(
      collection(db, 'employees'),
      where('employeeId', '==', employeeId)
    );
    const employeesSnapshot = await getDocs(employeesQuery);

    if (employeesSnapshot.empty) {
      // Try staffs collection
      const staffsQuery = query(
        collection(db, 'staffs'),
        where('employeeId', '==', employeeId)
      );
      const staffsSnapshot = await getDocs(staffsQuery);

      if (staffsSnapshot.empty) {
        return {
          success: false,
          message: `No user found with employee ID: ${employeeId}`,
          deletedFrom: []
        };
      }

      const staffDoc = staffsSnapshot.docs[0];
      const userId = staffDoc.data().authUserId || staffDoc.id;
      return await deleteUserData(userId, currentUser);
    }

    const employeeDoc = employeesSnapshot.docs[0];
    const userId = employeeDoc.id;
    return await deleteUserData(userId, currentUser);
  } catch (error: any) {
    console.error('Error in deleteUserDataByEmployeeId:', error);
    return {
      success: false,
      message: `Failed to find user: ${error.message}`,
      deletedFrom: []
    };
  }
};

