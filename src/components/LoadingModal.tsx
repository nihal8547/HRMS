import React, { useState } from 'react';
import './LoadingModal.css';

interface LoadingModalProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
}

/**
 * Standard Loading Modal Component
 * A reusable round loading indicator with modal overlay
 */
const LoadingModal: React.FC<LoadingModalProps> = ({ 
  isLoading, 
  message = 'Loading...',
  fullScreen = true 
}) => {
  const [logoError, setLogoError] = useState(false);

  if (!isLoading) return null;

  return (
    <div className={`loading-modal-overlay ${fullScreen ? 'fullscreen' : ''}`}>
      <div className="loading-modal-container">
        <div className="loading-logo-container">
          {!logoError && (
            <img 
              src="/logo.png" 
              alt="HRMS Logo" 
              className="loading-logo" 
              onError={() => setLogoError(true)}
            />
          )}
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
        </div>
        {message && (
          <p className="loading-modal-message">{message}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingModal;

