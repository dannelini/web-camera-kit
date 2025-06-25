import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { gsap } from 'gsap';
import { Camera, Video, SwitchCamera, Download, X, Play, Pause, Image, ArrowLeft, Settings } from 'lucide-react';
import { useMobileDetection } from '../hooks/useMobileDetection';
import { CameraMode, CameraFacing, CapturedMedia } from '../types/media';

interface CameraPreviewProps {
  mode: CameraMode;
  facing: CameraFacing;
  selectedDeviceId: string;
  setSelectedDeviceId: (deviceId: string) => void;
  onCapture: (media: CapturedMedia) => void;
  onModeChange: (mode: CameraMode) => void;
  onFacingChange: () => void;
  isCapturing: boolean;
  setIsCapturing: (capturing: boolean) => void;
  createMediaFromBlob: (blob: Blob, type: CameraMode) => CapturedMedia;
  onGalleryClick?: () => void;
  capturedMediaCount?: number;
  isPWA?: boolean;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  mode,
  facing,
  selectedDeviceId,
  setSelectedDeviceId,
  onCapture,
  onModeChange,
  onFacingChange,
  isCapturing,
  setIsCapturing,
  createMediaFromBlob,
  onGalleryClick,
  capturedMediaCount = 0,
  isPWA = false
}) => {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const captureButtonRef = useRef<HTMLDivElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);
  const switchCameraIconRef = useRef<SVGSVGElement>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { isMobile } = useMobileDetection();

  // Calculate camera height based on device type and PWA status
  const getCameraHeight = () => {
    if (isMobile) {
      return isPWA ? '82vh' : '76vh'; // More space in PWA mode
    }
    
    // Desktop: Use more height for narrow windows
    const windowWidth = window.innerWidth;
    if (windowWidth <= 900) {
      // Narrow desktop window - use more vertical space
      return '75vh';
    } else if (windowWidth <= 1200) {
      // Medium desktop window
      return '70vh';
    }
    return '65vh'; // Wide desktop
  };

  // Enumerate video devices for desktop
  useEffect(() => {
    if (!isMobile) {
      const getVideoDevices = async () => {
        try {
          // Request permissions first to ensure device enumeration works
          await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(stream => {
              stream.getTracks().forEach(track => track.stop());
            })
            .catch(() => {
              // Ignore permission errors here, will be handled by main camera logic
            });

          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(device => device.kind === 'videoinput');
          setVideoDevices(videoInputs);
          
          // Set default device if none selected
          if (!selectedDeviceId && videoInputs.length > 0) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        } catch (error) {
          console.error('Error enumerating devices:', error);
        }
      };

      getVideoDevices();
    }
  }, [isMobile, selectedDeviceId]);

  // Calculate video constraints with optimized settings
  const getVideoConstraints = useCallback(() => {
    const baseConstraints = {
      frameRate: { ideal: 30, max: 60 }
    };

    if (isMobile) {
      return {
        ...baseConstraints,
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: facing,
        aspectRatio: 16/9
      };
    } else {
      return {
        ...baseConstraints,
        width: { ideal: 1920, max: 2560 },
        height: { ideal: 1080, max: 1440 },
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
      };
    }
  }, [isMobile, facing, selectedDeviceId]);

  // Function to shorten device names
  const shortenDeviceName = useCallback((deviceName: string, index: number) => {
    if (!deviceName) return `Camera ${index + 1}`;
    
    // Clean up device name while preserving "Camera"
    let shortened = deviceName
      .replace(/\s+\([^)]+\)$/, '') // Remove parenthetical info
      .replace(/\s+HD$/, '')
      .replace(/\s+\d+p$/, '')
      .replace(/\s+USB$/, '')
      .replace(/\s+Video$/, '')
      .replace(/\s+Device$/, '')
      .trim();
    
    // Ensure "Camera" is in the name
    if (!shortened.toLowerCase().includes('camera')) {
      shortened = `Camera ${index + 1}`;
    }
    
    // If too long, truncate and add ellipsis
    if (shortened.length > 20) {
      shortened = shortened.substring(0, 17) + '...';
    }
    
    return shortened;
  }, []);
  const videoConstraints = getVideoConstraints();

  // Create canvas for real-time video processing
  const createProcessingCanvas = useCallback((stream: MediaStream) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    
    // Hide video element completely
    video.style.position = 'absolute';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.display = 'none';
    video.style.visibility = 'hidden';

    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight } = video;
      
      // Determine canvas dimensions based on device and orientation
      if (isMobile) {
        const isPortraitVideo = videoHeight > videoWidth;
        const isLandscapeOrientation = window.innerWidth > window.innerHeight;
        
        if (isPortraitVideo && isLandscapeOrientation) {
          canvas.width = videoHeight;
          canvas.height = videoWidth;
        } else {
          canvas.width = videoWidth;
          canvas.height = videoHeight;
        }
      } else {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }

      // Start real-time processing
      const processFrame = () => {
        if (video.readyState >= 2) {
          ctx.save();
          
          if (isMobile) {
            const isPortraitVideo = videoHeight > videoWidth;
            const isLandscapeOrientation = window.innerWidth > window.innerHeight;
            
            if (isPortraitVideo && isLandscapeOrientation) {
              // Rotate for mobile landscape
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate(Math.PI / 2);
              ctx.drawImage(video, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight);
            } else {
              // Mirror for front camera on mobile
              if (facing === 'user') {
                ctx.scale(-1, 1);
                ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
              } else {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              }
            }
          } else {
            // Desktop: always mirror
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          }
          
          ctx.restore();
        }
        
        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      video.play();
      processFrame();
    };

    canvasRef.current = canvas;
    return canvas.captureStream(30); // 30 FPS processed stream
  }, [isMobile, facing]);

  // Initialize processed stream when mediaStream changes
  useEffect(() => {
    if (mediaStream && mode === 'video') {
      const processedStream = createProcessingCanvas(mediaStream);
      if (processedStream) {
        processedStreamRef.current = processedStream;
        
        // Create MediaRecorder with optimized settings
        try {
          const options = isMobile 
            ? { 
                mimeType: 'video/webm;codecs=vp8',
                videoBitsPerSecond: 2500000 // 2.5 Mbps for mobile
              }
            : { 
                mimeType: 'video/webm;codecs=vp8',
                videoBitsPerSecond: 10000000 // 10 Mbps for desktop
              };

          const mediaRecorder = new MediaRecorder(processedStream, options);
          const chunks: Blob[] = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const videoBlob = new Blob(chunks, { type: 'video/webm' });
            const media = createMediaFromBlob(videoBlob, 'video');
            onCapture(media);
            setIsRecording(false);
            setIsCapturing(false);
          };

          mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            setError('Recording failed. Please try again.');
            setIsRecording(false);
            setIsCapturing(false);
          };

          mediaRecorderRef.current = mediaRecorder;
        } catch (error) {
          console.error('Failed to create MediaRecorder:', error);
          setError('Recording not supported on this device.');
        }
      }
    }

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (processedStreamRef.current) {
        processedStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [mediaStream, mode, isMobile, createProcessingCanvas, createMediaFromBlob, onCapture, setIsCapturing]);

  // Reset state when facing or mobile detection changes
  useEffect(() => {
    setIsInitializing(true);
    setIsReady(false);
    setError(null);
    setMediaStream(null);
    setIsRecording(false);
    setRetryCount(0);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (processedStreamRef.current) {
      processedStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    
    // Add a small delay to ensure cleanup is complete
    setTimeout(() => {
      setIsInitializing(false);
    }, 100);
  }, [facing, isMobile, selectedDeviceId]);

  const startRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      try {
        mediaRecorderRef.current.start(1000); // Record in 1-second chunks
        setIsRecording(true);
        setIsCapturing(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
        setError('Failed to start recording.');
      }
    }
  }, [setIsCapturing]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error('Failed to stop recording:', error);
        setError('Failed to stop recording.');
        setIsRecording(false);
        setIsCapturing(false);
      }
    }
  }, [setIsCapturing]);

  const capturePhoto = useCallback(() => {
    if (!webcamRef.current) return;
    
    setIsCapturing(true);
    
    setTimeout(() => {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        fetch(imageSrc)
          .then(res => res.blob())
          .then(blob => {
            const media = createMediaFromBlob(blob, 'photo');
            onCapture(media);
            setIsCapturing(false);
          })
          .catch(err => {
            console.error('Error converting photo:', err);
            setIsCapturing(false);
          });
      } else {
        setIsCapturing(false);
      }
    }, 100);
  }, [onCapture, createMediaFromBlob, setIsCapturing]);

  const handleUserMedia = useCallback((stream: MediaStream) => {
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      console.log('Video track settings:', settings);
      console.log(`Device type: ${isMobile ? 'Mobile' : 'Desktop'}, Constraints:`, videoConstraints);
    }
    
    setIsInitializing(false);
    setIsReady(true);
    setError(null);
    setMediaStream(stream);
    setRetryCount(0);
  }, [isMobile, videoConstraints]);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error('Camera error:', error);
    setIsInitializing(false);
    setIsReady(false);
    setMediaStream(null);
    
    // Implement retry logic for common initialization issues, especially in PWA
    if (retryCount < 3) {
      console.log(`Retrying camera initialization (attempt ${retryCount + 1}/3)`);
      setRetryCount(prev => prev + 1);
      
      // Progressive delay for retries
      const delay = isPWA ? (retryCount + 1) * 1500 : (retryCount + 1) * 1000;
      
      initTimeoutRef.current = setTimeout(() => {
        setError(null);
        setIsInitializing(true);
      }, delay);
    } else {
      setError(isPWA 
        ? 'Camera initialization failed. Please close and reopen the app, or refresh the page.'
        : 'Unable to access camera. Please check permissions and try refreshing the page.'
      );
    }
  }, [retryCount, isPWA]);

  // Add visibility change and pagehide listeners for PWA camera safety
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('PWA: App went into background, stopping camera tracks');
        
        // Stop all active media tracks
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => {
            console.log('PWA: Stopping track:', track.kind, track.label);
            track.stop();
          });
        }
        
        if (processedStreamRef.current) {
          processedStreamRef.current.getTracks().forEach(track => {
            track.stop();
          });
        }
        
        // Stop recording if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('PWA: Stopping active recording');
          mediaRecorderRef.current.stop();
        }
        
        // Reset camera state
        setIsReady(false);
        setMediaStream(null);
        setIsRecording(false);
      } else if (document.visibilityState === 'visible' && !isReady && !error) {
        console.log('PWA: App came back to foreground, re-initializing camera');
        
        // Force complete re-initialization by incrementing retry count
        // This triggers a Webcam component remount via the key prop
        setTimeout(() => {
          setError(null);
          setIsInitializing(true);
          setRetryCount(prev => prev + 1); // This forces Webcam remount
          
          // The webcam component will handle setting isInitializing to false
          // via onUserMedia or onUserMediaError callbacks
        }, 200);
      }
    };

    const handlePageHide = () => {
      console.log('PWA: Page hide event, stopping all camera resources');
      
      // Stop all active media tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      if (processedStreamRef.current) {
        processedStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Cancel any pending animation frames
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    
    // Also listen for beforeunload as additional safety
    const handleBeforeUnload = () => {
      console.log('PWA: Before unload, cleaning up camera resources');
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [mediaStream, isReady, error, isInitializing]); // Dependencies for proper re-attachment

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, []);

  // Handle camera switch with animation
  const handleSwitchCameraClick = useCallback(() => {
    // Trigger the camera switch
    onFacingChange();
    
    // Animate the icon
    if (switchCameraIconRef.current) {
      const tl = gsap.timeline();
      
      tl.to(switchCameraIconRef.current, {
        scale: 1.3,
        duration: 0.15,
        ease: "power2.out"
      })
      .to(switchCameraIconRef.current, {
        scale: 1,
        duration: 0.25,
        ease: "power2.out"
      });
    }
  }, [onFacingChange]);

  // Force camera reinitialization for PWA
  const handlePWARetry = useCallback(() => {
    setError(null);
    setIsReady(false);
    setRetryCount(0);
    setIsInitializing(true);
    
    // Clear any existing timeouts
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }
    
    // Force a complete reinitialization
    setTimeout(() => {
      setIsInitializing(false);
    }, 1000);
  }, []);

  return (
    <div className="relative space-y-1">
      {/* Camera Preview */}
      <div className={`relative w-full bg-black overflow-hidden shadow-2xl ${
        isMobile ? 'mx-auto' : 'rounded-2xl border border-zinc-700'
      }`} style={{ height: getCameraHeight() }}>
        {/* Camera Component */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          key={`webcam-${facing}-${selectedDeviceId}-${retryCount}`}
          className={`w-full h-full ${isMobile ? 'object-cover' : 'object-cover'}`}
          mirrored={isMobile ? facing === 'user' : true}
        />

        {/* Loading State */}
        {((!isReady && !error) || isInitializing) && (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center p-6">
            <div className="text-gray-100 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-100 mx-auto mb-4"></div>
              <p className="font-medium">
                {retryCount > 0 ? `Retrying camera... (${retryCount}/3)` : 'Initializing camera...'}
              </p>
              <p className="text-xs text-zinc-400 mt-2 max-w-xs">
                Device: {isMobile ? 'Mobile' : 'Desktop'} {isPWA ? '(PWA)' : ''} | 
                Resolution: {videoConstraints.width.ideal}×{videoConstraints.height.ideal}
              </p>
              {retryCount > 0 && (
                <p className="text-xs text-yellow-400 mt-1">
                  {isPWA ? 'PWA camera initialization in progress...' : 'Attempting to resolve initialization issue...'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Camera Error State */}
        {error && (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
            <div className="text-gray-100 text-center px-6">
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Camera className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-lg font-semibold mb-2">Camera Error</p>
              <p className="text-sm text-zinc-400 mb-6">{error}</p>
              <button
                onClick={isPWA ? handlePWARetry : () => window.location.reload()}
                className="bg-zinc-700 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-zinc-600 transition-all duration-200 shadow-lg"
              >
                {isPWA ? 'Retry Camera' : 'Try Again'}
              </button>
            </div>
          </div>
        )}

        {/* Capture Flash Effect */}
        {isCapturing && mode === 'photo' && (
          <div className="absolute inset-0 bg-white animate-pulse" style={{ animationDuration: '200ms' }} />
        )}

        {/* Top Left Controls - Desktop Camera Selection Only */}
        {!isMobile && videoDevices.length > 1 && (
          <div className="absolute top-4 left-4">
            <div className="relative">
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                disabled={isCapturing || isRecording}
                className="appearance-none bg-zinc-900/90 text-gray-100 px-3 py-1.5 pr-8 rounded-xl text-xs backdrop-blur-2xl border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                className="appearance-none bg-zinc-900/90 text-gray-100 px-3 py-1.5 pr-8 rounded-xl text-xs backdrop-blur-2xl border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-[#FF4D00] focus:border-[#FF4D00]"
                style={{
                  background: 'rgba(24, 24, 27, 0.9)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                {videoDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-zinc-900 text-gray-100 py-1">
                    {shortenDeviceName(device.label, index)}
                  </option>
                ))}
              </select>
              {/* Custom dropdown arrow */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 right-4">
            <div className="flex items-center space-x-2 bg-red-500/90 text-white px-3 py-1.5 rounded-full backdrop-blur-md border border-red-400/30">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-xs font-medium">REC</span>
            </div>
          </div>
        )}

        {/* Mode Selector - Desktop Only (Inside Camera Preview) */}
        {!isMobile && (
          <div 
            className="absolute bottom-6 left-6 bg-zinc-900/90 rounded-2xl p-1 backdrop-blur-xl border border-zinc-700 shadow-lg transition-all duration-200"
          >
            <div className="flex space-x-1">
              <button
                onClick={() => onModeChange('photo')}
                disabled={isCapturing || isRecording}
                className={`px-4 py-2 rounded-xl transition-all duration-300 text-sm font-medium ${
                  mode === 'photo'
                    ? 'bg-zinc-700 text-gray-100 shadow-lg'
                    : 'text-zinc-400 hover:text-gray-100 hover:bg-zinc-800'
                } ${(isCapturing || isRecording) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Photo
              </button>
              <button
                onClick={() => onModeChange('video')}
                disabled={isCapturing || isRecording}
                className={`px-4 py-2 rounded-xl transition-all duration-300 text-sm font-medium ${
                  mode === 'video'
                    ? 'bg-zinc-700 text-gray-100 shadow-lg'
                    : 'text-zinc-400 hover:text-gray-100 hover:bg-zinc-800'
                } ${(isCapturing || isRecording) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Video
              </button>
            </div>
          </div>
        )}

        {/* Capture Controls - Inside camera feed */}
        {mode === 'photo' && (
          <div 
            ref={captureButtonRef}
            key={mode}
            className="absolute bottom-6 left-1/2 transform -translate-x-1/2"
          >
            <button
              onClick={capturePhoto}
              disabled={!isReady || isCapturing}
              className={`
                ${isMobile ? 'w-20 h-20' : 'w-20 h-20'} rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-2xl backdrop-blur-md
                ${!isReady || isCapturing 
                  ? 'opacity-50 cursor-not-allowed bg-zinc-700/50 border-white/20' 
                  : 'cursor-pointer bg-zinc-700/70 hover:bg-zinc-600/80 hover:scale-105 active:scale-95 border-white/30 hover:border-white/50'
                }
              `}
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <Camera className={`${isMobile ? 'h-8 w-8' : 'h-8 w-8'} text-white/80`} />
            </button>
          </div>
        )}

        {mode === 'video' && (
          <div 
            ref={captureButtonRef}
            key={mode}
            className="absolute bottom-6 left-1/2 transform -translate-x-1/2"
          >
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isReady}
              className={`
                ${isMobile ? 'w-20 h-20' : 'w-20 h-20'} rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl border-2 backdrop-blur-md
                ${isRecording 
                  ? 'bg-red-500/80 hover:bg-red-600/90 border-white/30 hover:border-white/50' 
                  : 'bg-zinc-700/70 hover:bg-zinc-600/80 hover:scale-105 border-white/30 hover:border-white/50'
                }
                ${!isReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              {isRecording ? (
                <div className={`${isMobile ? 'w-6 h-6' : 'w-6 h-6'} bg-white/80 rounded-sm shadow-sm`} />
              ) : (
                <Video className={`${isMobile ? 'h-8 w-8' : 'h-8 w-8'} text-white/80`} />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Controls Section - Below camera feed */}
      <div className="flex items-center justify-center px-6 pt-4 pb-4">
        {/* Gallery Button for Mobile - Left */}
        {isMobile && (
          <button
            onClick={onGalleryClick}
            className="bg-zinc-800/80 text-gray-100 p-4 rounded-full hover:bg-zinc-700 transition-all duration-200 backdrop-blur-xl border border-zinc-700 shadow-lg relative"
            disabled={isCapturing || isRecording}
          >
            <Image className="h-6 w-6" />
            {capturedMediaCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#FF4D00] text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-medium shadow-md">
                {capturedMediaCount}
              </span>
            )}
          </button>
        )}

        {/* Spacer for mobile layout */}
        {isMobile && <div className="flex-1" />}

        {/* Mode Selector - Mobile Center */}
        {isMobile && (
          <div className="flex space-x-4">
            <button
              onClick={() => onModeChange('photo')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                mode === 'photo' ? 'bg-white text-zinc-900' : 'text-zinc-400'
              }`}
            >
              Photo
            </button>
            <button
              onClick={() => onModeChange('video')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                mode === 'video' ? 'bg-white text-zinc-900' : 'text-zinc-400'
              }`}
            >
              Video
            </button>
          </div>
        )}

        {/* Spacer for mobile layout */}
        {isMobile && <div className="flex-1" />}

        {/* Camera Switch for Mobile - Right */}
        {isMobile && (
          <button
            onClick={handleSwitchCameraClick}
            className="bg-zinc-800/80 text-gray-100 p-4 rounded-full hover:bg-zinc-700 transition-all duration-200 backdrop-blur-xl border border-zinc-700 shadow-lg"
            disabled={isCapturing || isRecording}
          >
            <SwitchCamera ref={switchCameraIconRef} className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
};