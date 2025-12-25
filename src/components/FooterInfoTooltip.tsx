import React from 'react';
import Icon from './Icons';
import './FooterInfoTooltip.css';

/**
 * FooterInfoTooltip component
 * Displays informational tooltip in the footer area for mobile devices
 */
const FooterInfoTooltip = () => {
  return (
    <div className="footer-info-tooltip">
      <div className="footer-info-tooltip-content">
        <div className="footer-info-tooltip-icon">
          <Icon name="alert-circle" />
        </div>
        <div className="footer-info-tooltip-text">
          <p className="footer-info-tooltip-title">Quick Navigation</p>
          <p className="footer-info-tooltip-description">
            Use the bottom navigation bar to quickly access main pages on mobile devices.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FooterInfoTooltip;
