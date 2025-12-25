import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from './Icons';
import './FooterInfoTooltip.css';

/**
 * FooterInfoTooltip Component
 * 
 * Displays a helpful tooltip message near the footer menu after a delay.
 * Shows once per session and auto-hides after a few seconds or on user interaction.
 */
const FooterInfoTooltip = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownRef = useRef(false);

  const handleHide = useCallback(() => {
    setIsHiding(true);
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    // Remove from DOM after animation completes
    setTimeout(() => {
      setIsVisible(false);
      setIsHiding(false);
    }, 300); // Match CSS animation duration
  }, []);

  useEffect(() => {
    // Check if tooltip has already been shown in this session
    const hasShown = sessionStorage.getItem('footerInfoTooltipShown') === 'true';
    
    if (hasShown || hasShownRef.current) {
      return;
    }

    // Wait 5 seconds before showing
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      hasShownRef.current = true;
      sessionStorage.setItem('footerInfoTooltipShown', 'true');

      // Auto-hide after 5 seconds
      hideTimeoutRef.current = setTimeout(() => {
        handleHide();
      }, 5000);
    }, 5000);

    // Handle user interaction - hide on click anywhere (but not on tooltip itself)
    const handleInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      // Don't hide if clicking on the tooltip itself
      if (target.closest('.footer-info-tooltip')) {
        return;
      }
      // Hide if visible (this will catch footer nav clicks, scrolls, and other interactions)
      if (isVisible) {
        handleHide();
      }
    };

    // Add event listeners for user interactions
    // Using capture phase for click to catch events before they bubble
    window.addEventListener('click', handleInteraction, true);
    window.addEventListener('scroll', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      window.removeEventListener('click', handleInteraction, true);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [isVisible, handleHide]);

  if (!isVisible && !isHiding) {
    return null;
  }

  return (
    <div 
      className={`footer-info-tooltip ${isHiding ? 'hiding' : 'showing'}`}
      onClick={(e) => {
        e.stopPropagation();
        handleHide();
      }}
    >
      <div className="footer-info-tooltip-content">
        <div className="footer-info-tooltip-icon">
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>
        <p className="footer-info-tooltip-text">
          Use the footer menu to quickly access requests, complaints, overtime, and more.
        </p>
        <button 
          className="footer-info-tooltip-close"
          onClick={(e) => {
            e.stopPropagation();
            handleHide();
          }}
          aria-label="Close tooltip"
        >
          <Icon name="x" />
        </button>
      </div>
    </div>
  );
};

export default FooterInfoTooltip;
