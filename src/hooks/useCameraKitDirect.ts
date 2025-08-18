import { useRef, useCallback, useState } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';

interface CameraKitState {
  isInitialized: boolean;
  isRecording: boolean;
  error: string | null;
  currentCamera: 'BACK' | 'FRONT';
}

export const useCameraKitDirect = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const [state, setState] = useState<CameraKitState>({
    isInitialized: false,
    isRecording: false,
    error: null,
    currentCamera: 'BACK'
  });

  // Store CameraKit instances
  const cameraKitRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamSourceRef = useRef<any>(null);
  const lensRef = useRef<any>(null);

  const initialize = useCallback(async () => {
    if (!canvasRef.current) {
      throw new Error('Canvas ref not available');
    }

    // Prevent multiple initializations
    if (state.isInitialized || cameraKitRef.current) {
      console.log('CameraKit already initialized, skipping...');
      return;
    }

    try {
      console.log('Initializing CameraKit...');
      
      // Get environment variables
      const API_TOKEN = import.meta.env.VITE_CAMERAKIT_API_TOKEN;
      const LENS_GROUP_ID = import.meta.env.VITE_CAMERAKIT_LENS_GROUP_ID;
      const LENS_ID = import.meta.env.VITE_CAMERAKIT_LENS_ID;

      console.log('Environment variables loaded:');
      console.log('API_TOKEN:', API_TOKEN ? `${API_TOKEN.substring(0, 20)}...` : 'NOT SET');
      console.log('LENS_GROUP_ID:', LENS_GROUP_ID || 'NOT SET');
      console.log('LENS_ID:', LENS_ID || 'NOT SET');

      if (!API_TOKEN || !LENS_GROUP_ID || !LENS_ID) {
        throw new Error(`CameraKit environment variables not configured: 
          API_TOKEN: ${API_TOKEN ? 'SET' : 'MISSING'}
          LENS_GROUP_ID: ${LENS_GROUP_ID ? 'SET' : 'MISSING'}
          LENS_ID: ${LENS_ID ? 'SET' : 'MISSING'}`);
      }

      // Bootstrap CameraKit
      const cameraKit = await bootstrapCameraKit({
        apiToken: API_TOKEN
      });
      cameraKitRef.current = cameraKit;

      const canvas = canvasRef.current;
      
      // Set canvas size with device pixel ratio
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';

      // Create session
      const session = await cameraKit.createSession({
        liveRenderTarget: canvas,
        renderOptions: {
          quality: 'high',
          antialiasing: true
        }
      });
      sessionRef.current = session;

      // Initialize camera
      await setCameraSide('BACK');

      // Load and apply lens
      const lens = await cameraKit.lensRepository.loadLens(LENS_ID, LENS_GROUP_ID);
      await session.applyLens(lens);
      lensRef.current = lens;

      setState(prev => ({ 
        ...prev, 
        isInitialized: true, 
        error: null 
      }));

      console.log('CameraKit initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CameraKit:', error);
      
      // More detailed error logging for authentication issues
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Check for authentication-specific errors
        if (error.message.includes('token') || error.message.includes('auth') || error.message.includes('401')) {
          console.error('Authentication failed - check API token');
        }
      }
      
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize CameraKit',
        isInitialized: false 
      }));
      throw error;
    }
  }, [canvasRef]);

  const setCameraSide = useCallback(async (side: 'BACK' | 'FRONT') => {
    if (!sessionRef.current || !cameraKitRef.current) return;

    try {
      const isBackFacing = side === 'BACK';

      // Stop current stream if exists
      if (mediaStreamRef.current) {
        sessionRef.current.pause();
        mediaStreamRef.current.getVideoTracks()[0].stop();
      }

      // Create new media stream
      const newMediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          frameRate: { ideal: 30 },
          facingMode: isBackFacing ? 'environment' : 'user',
        },
        audio: true,
      });

      const newSource = createMediaStreamSource(newMediaStream, {
        cameraType: isBackFacing ? 'environment' : 'user',
        disableSourceAudio: false,
      });

      await sessionRef.current.setSource(newSource);

      // Mirror front camera
      if (!isBackFacing) {
        newSource.setTransform(Transform2D.MirrorX);
      }

      // Update render size
      const dpr = window.devicePixelRatio || 1;
      newSource.setRenderSize(window.innerWidth * dpr, window.innerHeight * dpr);

      sessionRef.current.play();

      // Store references
      mediaStreamRef.current = newMediaStream;
      mediaStreamSourceRef.current = newSource;

      setState(prev => ({ 
        ...prev, 
        currentCamera: side 
      }));

    } catch (error) {
      console.error('Failed to set camera side:', error);
      throw error;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const newSide = state.currentCamera === 'BACK' ? 'FRONT' : 'BACK';
    await setCameraSide(newSide);
  }, [state.currentCamera, setCameraSide]);

  const startRecording = useCallback(() => {
    setState(prev => ({ ...prev, isRecording: true }));
  }, []);

  const stopRecording = useCallback(async () => {
    setState(prev => ({ ...prev, isRecording: false }));
  }, []);

  const takePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null;

    return new Promise((resolve) => {
      canvasRef.current!.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  }, [canvasRef]);

  const cleanup = useCallback(() => {
    // Only cleanup if actually initialized
    if (!cameraKitRef.current && !sessionRef.current) {
      console.log('CameraKit not initialized, skipping cleanup');
      return;
    }

    console.log('Cleaning up CameraKit...');
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (sessionRef.current) {
      sessionRef.current.pause();
      sessionRef.current = null;
    }

    cameraKitRef.current = null;
    mediaStreamSourceRef.current = null;
    lensRef.current = null;

    setState({
      isInitialized: false,
      isRecording: false,
      error: null,
      currentCamera: 'BACK'
    });
  }, []);

  return {
    state,
    actions: {
      initialize,
      switchCamera,
      startRecording,
      stopRecording,
      takePhoto,
      cleanup
    }
  };
};
