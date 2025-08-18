import React, { useEffect, useRef } from 'react';
import { Camera, Share, RotateCcw } from 'lucide-react';
import { useCameraKit } from '../hooks/useCameraKit';

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
  onOverlayShown
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraKitState, cameraKitActions] = useCameraKit(canvasRef);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [showError, setShowError] = React.useState(false);

  // Debug component mounting
  useEffect(() => {
    console.log('CameraKitPreview component mounted');
    return () => {
      console.log('CameraKitPreview component unmounted');
    };
  }, []);

  // Debug canvas ref changes
  useEffect(() => {
    console.log('Canvas ref changed:', canvasRef.current);
    if (canvasRef.current) {
      console.log('Canvas element details:', {
        tagName: canvasRef.current.tagName,
        width: canvasRef.current.width,
        height: canvasRef.current.height,
        style: canvasRef.current.style.cssText
      });
    }
  }, [canvasRef.current]);

  // Initialize Camera Kit when component mounts and canvas is ready
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max

    const initCameraKit = async () => {
      if (!isMounted) return;
      
      // Wait for canvas to be available
      if (!canvasRef.current) {
        retryCount++;
        console.log(`Canvas not ready, waiting... (attempt ${retryCount}/${maxRetries})`);
        
        if (retryCount >= maxRetries) {
          console.error('Canvas failed to load after maximum retries');
          setShowError(true);
          setIsInitializing(false);
          return;
        }
        
        setTimeout(initCameraKit, 100);
        return;
      }
      
      console.log('Canvas found:', canvasRef.current);
      console.log('Canvas dimensions:', canvasRef.current.width, 'x', canvasRef.current.height);
      
      try {
        setIsInitializing(true);
        setShowError(false);
        
        console.log('Canvas ready, initializing Camera Kit...');
        await cameraKitActions.initialize();
        
        if (!isMounted) return;
        setIsInitializing(false);
      } catch (error) {
        console.error('Failed to initialize Camera Kit:', error);
        if (isMounted) {
          setShowError(true);
          setIsInitializing(false);
        }
      }
    };

    // Start initialization after a short delay to ensure DOM is ready
    const timer = setTimeout(initCameraKit, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cameraKitActions.cleanup();
    };
  }, [cameraKitActions]);

  // Handle recording start
  const handleRecordStart = () => {
    try {
      cameraKitActions.startRecording();
      setIsCapturing?.(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
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
      await cameraKitActions.shareRecording();
    } catch (error) {
      console.error('Failed to share recording:', error);
    }
  };

  // Handle error display
  useEffect(() => {
    if (cameraKitState.error) {
      setShowError(true);
    }
  }, [cameraKitState.error]);

  if (isInitializing) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Initializing Camera Kit...</p>
          <div className="mt-4 text-sm text-gray-400">
            <p>API Token: {import.meta.env.VITE_CAMERAKIT_API_TOKEN ? '✅ Set' : '❌ Missing'}</p>
            <p>Lens Group: {import.meta.env.VITE_CAMERAKIT_LENS_GROUP_ID ? '✅ Set' : '❌ Missing'}</p>
            <p>Lens ID: {import.meta.env.VITE_CAMERAKIT_LENS_ID ? '✅ Set' : '❌ Missing'}</p>
            <p>Canvas Ref: {canvasRef.current ? '✅ Found' : '❌ Not Found'}</p>
            <p>Canvas Element: {canvasRef.current?.tagName || 'None'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (showError) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-4">
          <Camera className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold mb-2">Camera Kit Error</h2>
          <p className="text-gray-300 mb-4">
            {cameraKitState.error || 'Failed to initialize Camera Kit. Please check your API credentials and try again.'}
          </p>
          <button
            onClick={() => {
              setShowError(false);
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
      {/* Debug Info */}
      <div className="absolute top-4 right-4 bg-blue-500 text-white px-2 py-1 rounded text-xs z-50">
        Component Rendered
      </div>
      
      {/* Camera Kit Canvas */}
      <canvas
        id="camerakit-canvas"
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          minWidth: '320px',
          minHeight: '240px',
          border: '2px solid red', // Debug border
          backgroundColor: 'rgba(0,0,0,0.8)' // Debug background
        }}
        width={1920}
        height={1080}
        onLoad={() => {
          console.log('Canvas loaded and ready');
        }}
        onError={(e) => {
          console.error('Canvas error:', e);
        }}
      />
      
      {/* Fallback Canvas Test */}
      <canvas
        className="absolute top-0 left-0 w-32 h-32 border-2 border-yellow-400 bg-yellow-200"
        style={{ zIndex: 1000 }}
      >
        Fallback Canvas
      </canvas>
      
      {/* Canvas Status Indicator */}
      {!isInitializing && !showError && (
        <div className="absolute top-4 left-4 bg-green-500 text-white px-2 py-1 rounded text-xs">
          Canvas Ready
        </div>
      )}

      {/* Camera Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {/* Gallery Button */}
          <button
            onClick={onGalleryClick}
            className="relative p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
          >
            <Camera className="h-6 w-6 text-white" />
            {capturedMediaCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {capturedMediaCount}
              </span>
            )}
          </button>

          {/* Record Button */}
          <button
            onMouseDown={handleRecordStart}
            onMouseUp={handleRecordStop}
            onTouchStart={handleRecordStart}
            onTouchEnd={handleRecordStop}
            className={`relative p-6 rounded-full transition-all duration-200 ${
              cameraKitState.isRecording
                ? 'bg-red-500 scale-110'
                : 'bg-white hover:bg-gray-200'
            }`}
          >
            <div className={`w-8 h-8 rounded-full ${
              cameraKitState.isRecording ? 'bg-red-600' : 'bg-red-500'
            }`} />
            {cameraKitState.isRecording && (
              <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-pulse" />
            )}
          </button>

          {/* Camera Switch Button */}
          <button
            onClick={handleCameraSwitch}
            className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
          >
            <RotateCcw className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-6">
        <div className="flex items-center justify-between">
          {/* Mode Toggle */}
          <div className="flex bg-white/20 backdrop-blur-sm rounded-full p-1">
            <button
              onClick={() => onModeChange?.('photo')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                true ? 'bg-white text-black' : 'text-white hover:bg-white/20'
              }`}
            >
              Photo
            </button>
            <button
              onClick={() => onModeChange?.('video')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                false ? 'bg-white text-black' : 'text-white hover:bg-white/20'
              }`}
            >
              Video
            </button>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
          >
            <Share className="h-6 w-6 text-white" />
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
            <h2 className="text-xl font-bold mb-2">Camera Kit Ready</h2>
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
