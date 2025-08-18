import { useState, useEffect, useRef, useCallback } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit";
import { CanvasRecorder } from '../utils/CanvasRecorder';
import settings from '../utils/cameraKitSettings';
import { overrideConsoleLog } from '../utils/cameraKitHelpers';

// Configuration - these should be environment variables in production
const API_TOKEN = import.meta.env.VITE_CAMERAKIT_API_TOKEN;
const LENS_GROUP_ID = import.meta.env.VITE_CAMERAKIT_LENS_GROUP_ID;
const TARGET_LENS_ID = import.meta.env.VITE_CAMERAKIT_LENS_ID;

// Validate required environment variables
if (!API_TOKEN || !LENS_GROUP_ID || !TARGET_LENS_ID) {
  console.error('Missing required Camera Kit environment variables');
  console.error('API_TOKEN:', !!API_TOKEN);
  console.error('LENS_GROUP_ID:', !!LENS_GROUP_ID);
  console.error('LENS_ID:', !!TARGET_LENS_ID);
}

export interface CameraKitState {
  cameraKit: any;
  session: any;
  userMediaStream: MediaStream | null;
  mediaStreamSource: any;
  lens: any;
  currentCamera: 'BACK' | 'FRONT';
  canvasRecorder: CanvasRecorder | null;
  recordButtonReleased: boolean;
  audioContexts: AudioContext[];
  monitorNodes: MediaStreamAudioDestinationNode[];
  isInitialized: boolean;
  isRecording: boolean;
  error: string | null;
}

export interface CameraKitActions {
  initialize: () => Promise<void>;
  switchCamera: () => Promise<void>;
  setCameraSide: (side: 'BACK' | 'FRONT') => Promise<void>;
  setupRecorder: () => void;
  startRecording: () => void;
  stopRecording: () => Promise<void>;
  takeSnapshot: () => Promise<void>;
  shareRecording: () => Promise<void>;
  saveRecording: () => Promise<void>;
  cleanup: () => void;
}

export function useCameraKit(canvasRef?: React.RefObject<HTMLCanvasElement>): [CameraKitState, CameraKitActions] {
  const [state, setState] = useState<CameraKitState>({
    cameraKit: null,
    session: null,
    userMediaStream: null,
    mediaStreamSource: null,
    lens: null,
    currentCamera: settings.defaultCameraType,
    canvasRecorder: null,
    recordButtonReleased: false,
    audioContexts: [],
    monitorNodes: [],
    isInitialized: false,
    isRecording: false,
    error: null
  });

  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimestampRef = useRef<number>(0);
  
  // Use the provided canvas ref or the internal one
  const currentCanvasRef = canvasRef || internalCanvasRef;

  // Override console log based on settings
  useEffect(() => {
    overrideConsoleLog(settings.showDebugLog);
  }, []);

  // Setup audio context monitoring
  useEffect(() => {
    const originalAudioContext = window.AudioContext || (window as any).webkitAudioContext;
    let capturedAudioContext: AudioContext | null = null;

    const AudioContextWrapper = function() {
      capturedAudioContext = new originalAudioContext();
      console.log("Audio context created:", capturedAudioContext);

      setState(prev => ({
        ...prev,
        audioContexts: [...prev.audioContexts, capturedAudioContext!]
      }));

      return capturedAudioContext;
    };

    window.AudioContext = AudioContextWrapper as any;
    (window as any).webkitAudioContext = AudioContextWrapper as any;

    return () => {
      window.AudioContext = originalAudioContext;
      (window as any).webkitAudioContext = originalAudioContext;
    };
  }, []);

  // Setup audio node monitoring (simplified to avoid TypeScript issues)
  useEffect(() => {
    // Monitor audio contexts for lens audio
    const monitorAudioContext = (context: AudioContext) => {
      console.log("Audio context created:", context);
      setState(prev => ({
        ...prev,
        audioContexts: [...prev.audioContexts, context]
      }));
    };

    // Store original AudioContext constructor
    const OriginalAudioContext = window.AudioContext || (window as any).webkitAudioContext;
    
    // Override AudioContext constructor
    const AudioContextWrapper = function() {
      const context = new OriginalAudioContext();
      monitorAudioContext(context);
      return context;
    };

    window.AudioContext = AudioContextWrapper as any;
    (window as any).webkitAudioContext = AudioContextWrapper as any;

    return () => {
      window.AudioContext = OriginalAudioContext;
      (window as any).webkitAudioContext = OriginalAudioContext;
    };
  }, []);

  const initialize = useCallback(async () => {
    // Prevent multiple initializations
    if (state.isInitialized || state.cameraKit) {
      console.log('Camera Kit already initialized, skipping...');
      return;
    }

    try {
      setState(prev => ({ ...prev, error: null }));

      console.log('Initializing Camera Kit...');
      console.log('API Token length:', API_TOKEN?.length || 0);
      console.log('Lens Group ID:', LENS_GROUP_ID);
      console.log('Lens ID:', TARGET_LENS_ID);

      const cameraKit = await bootstrapCameraKit({
        apiToken: API_TOKEN
      });

      console.log('Camera Kit bootstrapped successfully');

      if (!currentCanvasRef.current) {
        console.warn('Camera Kit init skipped: canvas not ready');
        return; // silently skip; caller can retry later
      }

      const liveRenderTarget = currentCanvasRef.current;

      // Set canvas properties for better quality
      const dpr = window.devicePixelRatio || 1;
      liveRenderTarget.width = window.innerWidth * dpr;
      liveRenderTarget.height = window.innerHeight * dpr;

      console.log('Creating Camera Kit session...');
      const session = await cameraKit.createSession({
        liveRenderTarget
      });

      console.log('Session created successfully');

      // Initialize camera stream
      const isBackFacing = settings.defaultCameraType === 'BACK';
      console.log('Getting user media...');
      const newMediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          frameRate: { ideal: settings.recordVideoFrameRate },
          facingMode: isBackFacing ? 'environment' : 'user',
        },
        audio: true,
      });

      console.log('User media obtained, creating media stream source...');
      const newSource = createMediaStreamSource(newMediaStream, {
        cameraType: isBackFacing ? 'environment' : 'user',
        disableSourceAudio: false,
      });

      await session.setSource(newSource);

      if (!isBackFacing) {
        newSource.setTransform(Transform2D.MirrorX);
      }

      // Update render size with high quality settings
      const dpr2 = window.devicePixelRatio || 1;
      newSource.setRenderSize(window.innerWidth * dpr2, window.innerHeight * dpr2);

      console.log('Starting session...');
      session.play();

      // Load lens
      console.log('Loading lens...');
      const lens = await cameraKit.lensRepository.loadLens(TARGET_LENS_ID, LENS_GROUP_ID);
      await session.applyLens(lens);

      console.log('Camera Kit initialization complete');

      setState(prev => ({
        ...prev,
        cameraKit,
        session,
        userMediaStream: newMediaStream,
        mediaStreamSource: newSource,
        lens,
        isInitialized: true
      }));

    } catch (error) {
      console.error('Failed to initialize Camera Kit:', error);
      
      // Clean up any partial initialization
      if (state.userMediaStream) {
        state.userMediaStream.getTracks().forEach(track => track.stop());
      }
      if (state.session) {
        state.session.pause();
      }
      
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize Camera Kit',
        isInitialized: false,
        cameraKit: null,
        session: null,
        userMediaStream: null,
        mediaStreamSource: null,
        lens: null
      }));
    }
  }, [state.isInitialized, state.cameraKit, state.userMediaStream, state.session]);

  const setCameraSide = useCallback(async (toSide: 'BACK' | 'FRONT') => {
    try {
      const isBackFacing = toSide === 'BACK';

      // Stop the current session if it exists
      if (state.userMediaStream) {
        state.session?.pause();
        state.userMediaStream.getVideoTracks()[0].stop();
      }

      // Create new stream
      const newMediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          frameRate: { ideal: settings.recordVideoFrameRate },
          facingMode: isBackFacing ? 'environment' : 'user',
        },
        audio: true,
      });

      const newSource = createMediaStreamSource(newMediaStream, {
        cameraType: isBackFacing ? 'environment' : 'user',
        disableSourceAudio: false,
      });

      await state.session?.setSource(newSource);

      if (!isBackFacing) {
        newSource.setTransform(Transform2D.MirrorX);
      }

      // Update render size with high quality settings
      const dpr = window.devicePixelRatio || 1;
      newSource.setRenderSize(window.innerWidth * dpr, window.innerHeight * dpr);

      state.session?.play();

      setState(prev => ({
        ...prev,
        userMediaStream: newMediaStream,
        mediaStreamSource: newSource,
        currentCamera: toSide
      }));

    } catch (error) {
      console.error('Failed to switch camera:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to switch camera' 
      }));
    }
  }, [state.session, state.userMediaStream]);

  const switchCamera = useCallback(async () => {
    const newSide = state.currentCamera === 'BACK' ? 'FRONT' : 'BACK';
    await setCameraSide(newSide);
  }, [state.currentCamera, setCameraSide]);

  const setupRecorder = useCallback(() => {
    try {
      if (!currentCanvasRef.current) {
        throw new Error('Canvas element not found');
      }

      const monitoredStreams: MediaStream[] = [];

      // Add lens audios into the record stream
      if (settings.recordLensAudio) {
        for (let i = 0; i < state.monitorNodes.length; i++) {
          monitoredStreams.push(state.monitorNodes[i].stream);
        }
      }

      // Add user media stream into the record stream
      if (settings.recordMicrophoneAudio && state.userMediaStream) {
        monitoredStreams.push(state.userMediaStream);
      }

      const newRecorder = new CanvasRecorder(currentCanvasRef.current!, monitoredStreams);

      setState(prev => ({
        ...prev,
        canvasRecorder: newRecorder
      }));

    } catch (e) {
      console.error('Failed to create recorder:', e);
      setState(prev => ({ 
        ...prev, 
        error: e instanceof Error ? e.message : 'Failed to create recorder' 
      }));
    }
  }, [state.monitorNodes, state.userMediaStream]);

  const startRecording = useCallback(() => {
    try {
      if (!state.canvasRecorder) {
        setupRecorder();
      }

      setState(prev => ({ 
        ...prev, 
        recordButtonReleased: false,
        isRecording: true 
      }));

      startTimestampRef.current = Date.now();

      // Delay start record
      setTimeout(() => {
        if (!state.recordButtonReleased) {
          state.canvasRecorder?.start();
        }
      }, 300);

    } catch (e) {
      console.error('Failed to start recording:', e);
      setState(prev => ({ 
        ...prev, 
        error: e instanceof Error ? e.message : 'Failed to start recording',
        isRecording: false 
      }));
    }
  }, [state.canvasRecorder, state.recordButtonReleased, setupRecorder]);

  const stopRecording = useCallback(async () => {
    try {
      setState(prev => ({ 
        ...prev, 
        recordButtonReleased: true,
        isRecording: false 
      }));

      const nowTimestamp = Date.now();
      const duration = nowTimestamp - startTimestampRef.current;
      const isClickEvent = duration < 300;

      if (isClickEvent) {
        state.canvasRecorder?.stop();
        await takeSnapshot();
      } else {
        // Save video
        state.canvasRecorder?.stop();
        const recordedFileName = settings.recordedFileName + "_" + new Date().toISOString().replace(/:/g, "-").slice(0, 19);
        await state.canvasRecorder?.save(recordedFileName);
      }

    } catch (e) {
      console.error('Failed to stop/save recording:', e);
      setState(prev => ({ 
        ...prev, 
        error: e instanceof Error ? e.message : 'Failed to stop recording' 
      }));
    }
  }, [state.canvasRecorder]);

  const takeSnapshot = useCallback(async () => {
    try {
      const saveSnapshotName = settings.snapshotFileName + "_" + new Date().toISOString().replace(/:/g, "-").slice(0, 19);
      await state.canvasRecorder?.saveSnapshot(saveSnapshotName);
    } catch (error) {
      console.error('Failed to take snapshot:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to take snapshot' 
      }));
    }
  }, [state.canvasRecorder]);

  const shareRecording = useCallback(async () => {
    try {
      await state.canvasRecorder?.share();
    } catch (error) {
      console.error('Failed to share recording:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to share recording' 
      }));
    }
  }, [state.canvasRecorder]);

  const saveRecording = useCallback(async () => {
    try {
      const recordedFileName = settings.recordedFileName + "_" + new Date().toISOString().replace(/:/g, "-").slice(0, 19);
      await state.canvasRecorder?.save(recordedFileName);
    } catch (error) {
      console.error('Failed to save recording:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to save recording' 
      }));
    }
  }, [state.canvasRecorder]);

  const cleanup = useCallback(() => {
    if (state.userMediaStream) {
      state.userMediaStream.getTracks().forEach(track => track.stop());
    }
    if (state.session) {
      state.session.pause();
    }
    setState(prev => ({
      ...prev,
      userMediaStream: null,
      session: null,
      isInitialized: false
    }));
  }, [state.userMediaStream, state.session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const actions: CameraKitActions = {
    initialize,
    switchCamera,
    setCameraSide,
    setupRecorder,
    startRecording,
    stopRecording,
    takeSnapshot,
    shareRecording,
    saveRecording,
    cleanup
  };

  return [state, actions];
}
