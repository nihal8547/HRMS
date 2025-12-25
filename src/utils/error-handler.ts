/**
 * Centralized Error Handling
 * Replace console.error with proper error handling
 */

export const handleError = (error: any, context: string, showAlert = false) => {
  // In production, you might want to send to error tracking service
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  }
  
  // Log to error tracking service (e.g., Sentry) in production
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, { tags: { context } });
  // }
  
  if (showAlert && error?.message) {
    // Only show user-friendly messages
    const userMessage = error.message || 'An error occurred. Please try again.';
    // You can use a toast notification library here instead
    return userMessage;
  }
  
  return null;
};

export const logInfo = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development' && data) {
    console.log(`[INFO] ${message}`, data);
  } else if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] ${message}`);
  }
};

export const logWarning = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development' && data) {
    console.warn(`[WARNING] ${message}`, data);
  } else if (process.env.NODE_ENV === 'development') {
    console.warn(`[WARNING] ${message}`);
  }
};

