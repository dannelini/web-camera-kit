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

    try {
      console.log('Initializing CameraKit...');
      
      // Hardcoded API tokens for validation
      const API_TOKEN = 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzA3MTMwNjMwLCJzdWIiOiI4MWMyYWQ1OS05NDk2LTQ0YzMtYWIwNC0yNjdiYzJkMmRlYWZ-UFJPRFVDVElPTn5lNGFmYzVjMC1hOTVjLTQ4ODMtOWJkMy03NTBmZWIxYjI2MDcifQ.XXKseCwAs6piC0ot_04IiohnzBTuTB6BsnP_ofvGlPw';
      const LENS_GROUP_ID = 'f901e170-8c27-41d1-9443-aed78bbc3e73';
      const LENS_ID = '43281170875';

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
