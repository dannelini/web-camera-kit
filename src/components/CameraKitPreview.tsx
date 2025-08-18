import React, { useEffect, useRef } from 'react';
import { Camera, Share, RotateCcw } from 'lucide-react';
import { useCameraKitDirect } from '../hooks/useCameraKitDirect';

interface CameraKitPreviewProps {
  onCapture?: (blob: Blob) => void;
  onModeChange?: (mode: 'photo' | 'video') => void;
  onFacingChange?: () => void;
  isCapturing?: boolean;
  setIsCapturing?: (capturing: boolean) => void;
  createMediaFromBlob?: (blob: Blob, type: 'photo' | 'video') => void;
  onGalleryClick?: () => void;
  capturedMediaCount?: number;
  isPWA?: boolean;
  shouldShowInitialOverlay?: boolean;
  onOverlayShown?: () => void;
  cameraMode?: 'photo' | 'video';
}

export const CameraKitPreview: React.FC<CameraKitPreviewProps> = ({
  onCapture,
  onModeChange,
  onFacingChange,
  isCapturing,
  setIsCapturing,
  createMediaFromBlob,
  onGalleryClick,
  capturedMediaCount = 0,
  isPWA = false,
  shouldShowInitialOverlay = false,
  onOverlayShown,
  cameraMode = 'photo'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state: cameraKitState, actions: cameraKitActions } = useCameraKitDirect(canvasRef);
  const [isInitializing, setIsInitializing] = React.useState(true);
  
  // Component is ready when mounted (permissions already granted at app level)
  useEffect(() => {
    console.log('CameraKitPreview mounted - permissions should already be granted');
    console.log('Canvas ref current:', canvasRef.current);
    console.log('CameraKit state:', cameraKitState);
    console.log('CameraKit actions:', cameraKitActions);
  }, []);

  // Component lifecycle logging
  useEffect(() => {
    console.log('CameraKitPreview component mounted');
    return () => {
      console.log('CameraKitPreview component unmounted');
    };
  }, []);

  // Initialize Camera Kit when component mounts (permissions already granted)
  useEffect(() => {
    let isMounted = true;
    let initTimeout: NodeJS.Timeout;

    const initCameraKit = async () => {
      try {
        console.log('Initializing CameraKit...');
        await cameraKitActions.initialize();
        
        if (!isMounted) return;
        setIsInitializing(false);
      } catch (error) {
        console.error('Failed to initialize Camera Kit:', error);
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    // Wait for canvas to be ready, then initialize
    initTimeout = setTimeout(() => {
      console.log('Timeout reached - checking canvas readiness');
      console.log('isMounted:', isMounted);
      console.log('canvasRef.current:', canvasRef.current);
      
      if (isMounted && canvasRef.current) {
        console.log('Canvas is ready, starting CameraKit initialization...');
        initCameraKit();
      } else {
        console.log('Canvas not ready yet, skipping initialization');
      }
    }, 100); // Canvas should be ready quickly now

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      // Only cleanup on unmount, not on re-renders
      if (cameraKitActions.cleanup) {
        console.log('Cleaning up CameraKit on unmount');
        cameraKitActions.cleanup();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Handle recording start
  const handleRecordStart = () => {
    try {
      cameraKitActions.startRecording();
      setIsCapturing?.(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // Handle photo capture
  const handlePhotoCapture = async () => {
    try {
      const blob = await cameraKitActions.takePhoto();
      if (blob && onCapture) {
        onCapture(blob);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
    }
  };

  // Handle recording stop
  const handleRecordStop = async () => {
    try {
      await cameraKitActions.stopRecording();
      setIsCapturing?.(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsCapturing?.(false);
    }
  };

  // Handle camera switch
  const handleCameraSwitch = async () => {
    try {
      await cameraKitActions.switchCamera();
      onFacingChange?.();
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  // Handle share
  const handleShare = async () => {
    try {
      console.log('Share functionality not implemented yet');
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  // Don't hide canvas during initialization - we need it to exist for the ref

  if (cameraKitState.error) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-4">
          <Camera className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold mb-2">Camera Error</h2>
          <p className="text-gray-300 mb-4">
            {cameraKitState.error}
          </p>
          <button
            onClick={() => {
              setIsInitializing(true);
              cameraKitActions.initialize();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Camera Kit Canvas */}
      <canvas
        id="camerakit-canvas"
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          position: 'relative',
          zIndex: 1
        }}
      />

      {/* Loading overlay while initializing */}
      {isInitializing && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Initializing Camera...</p>
          </div>
        </div>
      )}

      {/* Camera Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 to-transparent z-20">
        <div className="flex items-center justify-between max-w-sm sm:max-w-md mx-auto">
          {/* Gallery Button */}
          <button
            onClick={onGalleryClick}
            className="relative p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors touch-manipulation"
          >
            <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            {capturedMediaCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center text-[10px] sm:text-xs">
                {capturedMediaCount}
              </span>
            )}
          </button>

          {/* Record Button */}
          <button
            onMouseDown={cameraMode === 'video' ? handleRecordStart : undefined}
            onMouseUp={cameraMode === 'video' ? handleRecordStop : undefined}
            onTouchStart={cameraMode === 'video' ? handleRecordStart : undefined}
            onTouchEnd={cameraMode === 'video' ? handleRecordStop : undefined}
            onClick={cameraMode === 'photo' ? handlePhotoCapture : undefined}
            className={`relative p-4 sm:p-6 rounded-full transition-all duration-200 touch-manipulation ${
              cameraKitState.isRecording
                ? 'bg-red-500 scale-110'
                : 'bg-white hover:bg-gray-200'
            }`}
          >
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full ${
              cameraKitState.isRecording ? 'bg-red-600' : 'bg-red-500'
            }`} />
            {cameraKitState.isRecording && (
              <div className="absolute inset-0 rounded-full border-2 sm:border-4 border-red-400 animate-pulse" />
            )}
          </button>

          {/* Camera Switch Button */}
          <button
            onClick={handleCameraSwitch}
            className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors touch-manipulation"
          >
            <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 z-20">
        <div className="flex items-center justify-between">
          {/* Mode Toggle */}
          <div className="flex bg-white/20 backdrop-blur-sm rounded-full p-1">
            <button
              onClick={() => onModeChange?.('photo')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
                cameraMode === 'photo' ? 'bg-white text-black' : 'text-white hover:bg-white/20'
              }`}
            >
              Photo
            </button>
            <button
              onClick={() => onModeChange?.('video')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
                cameraMode === 'video' ? 'bg-white text-black' : 'text-white hover:bg-white/20'
              }`}
            >
              Video
            </button>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors touch-manipulation"
          >
            <Share className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Recording Indicator */}
      {cameraKitState.isRecording && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center space-x-2 bg-red-500 text-white px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
          </div>
        </div>
      )}

      {/* Initial Overlay */}
      {shouldShowInitialOverlay && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-center text-white max-w-md mx-4">
            <Camera className="h-16 w-16 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Camera Ready</h2>
            <p className="text-gray-300 mb-4">
              Tap and hold the record button to record video, or tap quickly to take a photo.
            </p>
            <button
              onClick={onOverlayShown}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
