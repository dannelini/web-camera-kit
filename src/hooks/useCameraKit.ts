import { useState, useEffect, useRef, useCallback } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit";
import { CanvasRecorder } from '../utils/CanvasRecorder';
import settings from '../utils/cameraKitSettings';
import { overrideConsoleLog } from '../utils/cameraKitHelpers';

// Configuration - these should be environment variables in production
const API_TOKEN = import.meta.env.VITE_CAMERAKIT_API_TOKEN || 'INSERT-YOUR-TOKEN';
const LENS_GROUP_ID = import.meta.env.VITE_CAMERAKIT_LENS_GROUP_ID || 'INSERT-YOUR-GROUP-ID';
const TARGET_LENS_ID = import.meta.env.VITE_CAMERAKIT_LENS_ID || 'YOUR-LENS-ID';

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

export function useCameraKit(): [CameraKitState, CameraKitActions] {
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimestampRef = useRef<number>(0);

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

  // Setup audio node monitoring
  useEffect(() => {
    const originalConnect = AudioNode.prototype.connect;

    AudioNode.prototype.connect = function(destinationNode: any) {
      console.log("Audio Node Connecting: " + this + " to " + destinationNode);

      if (destinationNode instanceof AudioDestinationNode) {
        console.log("final node found");

        const streamNode = this.context.createMediaStreamDestination();
        setState(prev => ({
          ...prev,
          monitorNodes: [...prev.monitorNodes, streamNode]
        }));

        this.connect(streamNode);
      }

      return originalConnect.apply(this, arguments as any);
    };

    return () => {
      AudioNode.prototype.connect = originalConnect;
    };
  }, []);

  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const cameraKit = await bootstrapCameraKit({
        apiToken: API_TOKEN
      });

      if (!canvasRef.current) {
        throw new Error('Canvas element not found');
      }

      const liveRenderTarget = canvasRef.current;

      // Set canvas properties for better quality
      const dpr = window.devicePixelRatio || 1;
      liveRenderTarget.width = window.innerWidth * dpr;
      liveRenderTarget.height = window.innerHeight * dpr;

      const session = await cameraKit.createSession({
        liveRenderTarget,
        renderOptions: {
          quality: 'high',
          antialiasing: true
        }
      });

      // Initialize camera stream
      const isBackFacing = settings.defaultCameraType === 'BACK';
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

      await session.setSource(newSource);

      if (!isBackFacing) {
        newSource.setTransform(Transform2D.MirrorX);
      }

      // Update render size with high quality settings
      const dpr2 = window.devicePixelRatio || 1;
      newSource.setRenderSize(window.innerWidth * dpr2, window.innerHeight * dpr2);

      session.play();

      // Load lens
      const lens = await cameraKit.lensRepository.loadLens(TARGET_LENS_ID, LENS_GROUP_ID);
      await session.applyLens(lens);

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
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize Camera Kit' 
      }));
    }
  }, []);

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
      if (!canvasRef.current) {
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

      const newRecorder = new CanvasRecorder(canvasRef.current, monitoredStreams);

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
