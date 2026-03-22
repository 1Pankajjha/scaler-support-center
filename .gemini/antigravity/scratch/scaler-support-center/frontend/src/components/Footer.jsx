import React from 'react';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      background: '#0d1b3e',
      width: '100%',
      boxSizing: 'border-box',
      borderTop: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <span style={{ fontSize: '13px', color: 'rgba(200,213,235,0.5)', margin: 0 }}>
          ©️ {year} InterviewBit Technologies Pvt. Ltd. All Rights Reserved.
        </span>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a
            href="https://www.scaler.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '13px', color: 'rgba(200,213,235,0.55)', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.color = 'white'}
            onMouseLeave={e => e.target.style.color = 'rgba(200,213,235,0.55)'}
          >
            Privacy Policy
          </a>
          <a
            href="https://www.scaler.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '13px', color: 'rgba(200,213,235,0.55)', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.color = 'white'}
            onMouseLeave={e => e.target.style.color = 'rgba(200,213,235,0.55)'}
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
