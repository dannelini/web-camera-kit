import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Camera, Zap, Shield, Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
  isPWA?: boolean;
  isInitialCheck?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  isPWA = false,
  isInitialCheck = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const privacyRef = useRef<HTMLParagraphElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  const [showButton, setShowButton] = useState(false);

  // Skip animation for initial permission checks in PWA to make it faster
  const shouldSkipAnimation = isPWA && isInitialCheck;

  // Set initial hidden state immediately on mount
  useEffect(() => {
    if (!shouldSkipAnimation) {
      // Immediately hide all elements before any animation
      gsap.set([logoRef.current, titleRef.current, subtitleRef.current, privacyRef.current], {
        opacity: 0,
        y: 30
      });

      gsap.set(orbRef.current, {
        scale: 0,
        rotation: -180
      });

      // Button uses CSS transition, not GSAP
      setShowButton(false);
    } else {
      // For PWA initial checks, show elements immediately
      gsap.set([logoRef.current, titleRef.current, subtitleRef.current, privacyRef.current], {
        opacity: 1,
        y: 0
      });

      gsap.set(orbRef.current, {
        scale: 1,
        rotation: 0
      });
      setShowButton(true);
      setHasAnimatedIn(true);
    }
  }, [shouldSkipAnimation]);

  // Initial entrance animation
  useEffect(() => {
    if (!hasAnimatedIn && !shouldSkipAnimation) {
      const tl = gsap.timeline({
        onComplete: () => setHasAnimatedIn(true)
      });

      // Animate entrance
      tl.to(orbRef.current, {
        scale: 1,
        rotation: 0,
        duration: 1.2,
        ease: "back.out(1.7)"
      })
      .to(logoRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out"
      }, "-=0.6")
      .to(titleRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out"
      }, "-=0.4")
      .to(subtitleRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out"
      }, "-=0.4")
      .call(() => {
        // Show button with CSS transition instead of GSAP
        setShowButton(true);
      }, [], "-=0.4")
      .to(privacyRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power3.out"
      }, "-=0.2");
    }
  }, [hasAnimatedIn, shouldSkipAnimation]);

  // Continuous animations
  useEffect(() => {
    if (!hasAnimatedIn || shouldSkipAnimation) return;

    // Floating orb animation
    gsap.to(orbRef.current, {
      y: -10,
      duration: 2,
      ease: "power2.inOut",
      yoyo: true,
      repeat: -1
    });

    // Pulsing glow effect
    gsap.to(logoRef.current, {
      scale: 1.05,
      duration: 2,
      ease: "power2.inOut",
      yoyo: true,
      repeat: -1
    });

  }, [hasAnimatedIn, shouldSkipAnimation]);

  const requestPermissions = async () => {
    setIsRequesting(true);
    
    // Button loading animation
    if (buttonRef.current) {
      gsap.to(buttonRef.current, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1
      });
    }

    try {
      // Add a longer delay for PWA to ensure proper initialization
      await new Promise(resolve => setTimeout(resolve, isPWA ? 500 : 300));
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      // Add another delay to ensure cleanup is complete, especially for PWA
      await new Promise(resolve => setTimeout(resolve, isPWA ? 400 : 200));
      
      // Success animation
      if (!shouldSkipAnimation) {
        const tl = gsap.timeline({
          onComplete: () => {
            setTimeout(onPermissionGranted, 500);
          }
        });

        tl.to(containerRef.current, {
          scale: 1.02,
          duration: 0.3,
          ease: "power2.out"
        })
        .to(containerRef.current, {
          opacity: 0,
          scale: 0.98,
          duration: 0.5,
          ease: "power2.in"
        });
      } else {
        // For PWA, skip animation and proceed immediately
        onPermissionGranted();
      }

    } catch (error) {
      console.error('Permission denied:', error);
      setIsRequesting(false);
      
      // Error shake animation
      if (!shouldSkipAnimation && containerRef.current) {
        gsap.to(containerRef.current, {
          x: -5,
          duration: 0.1,
          yoyo: true,
          repeat: 3,
          ease: "power2.inOut",
          onComplete: () => {
            gsap.set(containerRef.current, { x: 0 });
            onPermissionDenied();
          }
        });
      } else {
        onPermissionDenied();
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center p-6 overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 20% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 40% 40%, rgba(6, 182, 212, 0.08) 0%, transparent 50%),
          linear-gradient(135deg, #0a0a0a 0%, #111111 25%, #0f0f0f 50%, #0d0d0d 75%, #0a0a0a 100%)
        `
      }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-blue-500/30 to-cyan-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-gradient-to-l from-purple-500/25 to-indigo-400/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-teal-400/20 to-blue-600/15 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-3/4 left-1/6 w-48 h-48 bg-gradient-to-tr from-cyan-300/15 to-blue-400/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center max-w-md w-full">
        {/* Floating Orb */}
        <div ref={orbRef} className="relative mx-auto mb-8 w-32 h-32">
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-700 to-zinc-600 rounded-full blur-xl opacity-40"></div>
          <div className="relative bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900 rounded-full w-full h-full flex items-center justify-center shadow-2xl border border-zinc-600/30">
            <div ref={logoRef} className="text-white">
              <img 
                src="/white_circle_360x360.png" 
                alt="CameraApp Logo" 
                className="h-32 w-32 drop-shadow-lg" 
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 ref={titleRef} className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent font-sans">
          Web Camera Kit
        </h1>

        {/* Subtitle */}
        <div ref={subtitleRef} className="text-gray-400 text-sm mb-8 leading-relaxed font-sans font-medium space-y-1">
          {isInitialCheck && isPWA 
            ? <p>Checking camera access...</p>
            : (
                <>
                  <p>A lightweight, mobile-optimized camera boilerplate.</p>
                  <p>Perfect for real-world AI and CV projects</p>
                  <p>—right in the browser</p>
                </>
              )
          }
        </div>

        {/* Permission Button */}
        {!isInitialCheck && (
        <button
          ref={buttonRef}
          onClick={requestPermissions}
          disabled={isRequesting}
          className={`
            w-full text-white py-4 px-8 rounded-2xl font-semibold text-lg font-sans
            shadow-2xl shadow-black/30 border border-white/20 backdrop-blur-xl
            transition-all duration-800 transform
            disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100
            relative overflow-hidden group
            hover:scale-105 active:scale-95
            ${showButton ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.2),
              inset 0 -1px 0 rgba(255, 255, 255, 0.1)
            `
          }}
          onMouseEnter={(e) => {
            if (!isRequesting) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRequesting) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          <div className="relative z-10 flex items-center justify-center space-x-3">
            {isRequesting ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                <span>Requesting Access...</span>
              </>
            ) : (
              <>
                <Camera className="h-5 w-5" />
                <span>Enable Camera Access</span>
              </>
            )}
          </div>
          
          {/* Button glow effect */}
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"></div>
        </button>
        )}

        {/* Initial Check Loading */}
        {isInitialCheck && isPWA && (
          <div className="flex items-center justify-center space-x-3 py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            <span className="text-white font-medium">Initializing...</span>
          </div>
        )}

        {/* Privacy Note */}
        <p 
          ref={privacyRef}
          className="text-[10px] text-gray-500 mt-6 leading-tight max-w-[360px] mx-auto font-sans font-light"
        >
          {isPWA 
            ? 'PWA mode: Enhanced offline capabilities. Your privacy is protected.'
            : 'Your privacy is protected. Camera access is only used for capturing media. No data is stored or transmitted externally.'
          }
        </p>
      </div>
    </div>
  );
};