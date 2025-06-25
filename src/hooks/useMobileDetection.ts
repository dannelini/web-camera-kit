import { useState, useEffect } from 'react';

export const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100vh');
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const checkPWAMode = () => {
      // Check if running in standalone mode (PWA)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // Check for iOS Safari standalone mode
      const isIOSStandalone = (window.navigator as any).standalone === true;
      // Check if launched from home screen
      const isFromHomeScreen = window.location.search.includes('homescreen=1');
      
      setIsPWA(isStandalone || isIOSStandalone || isFromHomeScreen);
    };

    const updateViewportHeight = () => {
      setViewportHeight(`${window.innerHeight}px`);
    };

    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));
      const isMobileScreen = window.innerWidth <= 768;
      
      setIsMobile(isMobileUserAgent || isMobileScreen);
      
      // Update viewport height when mobile state changes
      if (isMobileUserAgent || isMobileScreen) {
        updateViewportHeight();
      }
    };

    
    // Check for touch capability as additional indicator
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    checkMobile();
    // Prioritize user agent detection over screen size
    // Only consider screen size for touch devices without clear mobile user agent
    const isMobileScreen = window.innerWidth <= 768;
    
    if (isMobileUserAgent) {
      // Definitely mobile based on user agent
      setIsMobile(true);
    } else if (isTouchDevice && isMobileScreen) {
      // Touch device with small screen (probably tablet in portrait)
      setIsMobile(true);
    } else {
      // Desktop device (even if window is small)
      setIsMobile(false);
    }
    // Add both resize listeners
    const handleResize = () => {
    }
    if (isMobileUserAgent || (isTouchDevice && isMobileScreen)) {
      updateViewportHeight();
      checkPWAMode();
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', updateViewportHeight);
    
    // Initial viewport height calculation
    updateViewportHeight();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', updateViewportHeight);
    };
  }, []);

  return { isMobile, viewportHeight, isPWA };
};