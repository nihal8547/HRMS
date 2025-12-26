import React from 'react';
import './Loading.css';

interface LoadingProps {
  /**
   * Size of the loading spinner
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Optional message to display below the spinner
   */
  message?: string;
  
  /**
   * If true, displays as a full-page loading overlay
   * @default false
   */
  fullPage?: boolean;
  
  /**
   * If true, displays as an inline loading indicator
   * @default false
   */
  inline?: boolean;
  
  /**
   * Custom className for additional styling
   */
  className?: string;
}

/**
 * Standard Loading Component
 * A reusable loading spinner that can be used inline, full-page, or as a small indicator
 */
const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  message,
  fullPage = false,
  inline = false,
  className = ''
}) => {
  const containerClass = [
    'loading-component',
    fullPage ? 'loading-full-page' : '',
    inline ? 'loading-inline' : '',
    className
  ].filter(Boolean).join(' ');

  const spinnerClass = `loading-spinner loading-spinner-${size}`;

  return (
    <div className={containerClass}>
      <div className={spinnerClass}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {message && (
        <p className="loading-message">{message}</p>
      )}
    </div>
  );
};

export default Loading;


