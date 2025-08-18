import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export class VideoRecorder {
  private canvas: HTMLCanvasElement;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private canvasStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private ffmpeg: FFmpeg | null = null;
  private isRecording = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initializeFFmpeg(): Promise<void> {
    if (this.ffmpeg) return;

    this.ffmpeg = new FFmpeg();
    
    // Load FFmpeg
    const baseURL = '/ffmpeg/0.12.10';
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    console.log('FFmpeg loaded successfully');
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.log('Already recording');
      return;
    }

    try {
      console.log('Starting video recording...');

      // Get canvas stream
      this.canvasStream = this.canvas.captureStream(30); // 30 FPS
      
      // Get audio stream (microphone)
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        },
        video: false
      });

      // Combine video and audio streams
      this.combinedStream = new MediaStream([
        ...this.canvasStream.getVideoTracks(),
        ...this.audioStream.getAudioTracks()
      ]);

      // Set up MediaRecorder with high quality settings
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000, // 2.5 Mbps
        audioBitsPerSecond: 128000   // 128 kbps
      };

      // Fallback to VP8 if VP9 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
      }

      // Final fallback
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }

      console.log('Using MIME type:', options.mimeType);

      this.mediaRecorder = new MediaRecorder(this.combinedStream, options);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('Recording stopped');
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;

      console.log('Video recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('Not currently recording');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not available'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          console.log('Processing recorded video...');
          
          // Create blob from recorded chunks
          const webmBlob = new Blob(this.recordedChunks, { type: 'video/webm' });
          console.log('WebM blob size:', webmBlob.size);

          // Convert to MP4 using FFmpeg
          const mp4Blob = await this.convertToMP4(webmBlob);
          
          // Cleanup
          this.cleanup();
          
          resolve(mp4Blob);
        } catch (error) {
          console.error('Error processing video:', error);
          reject(error);
        }
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }

  private async convertToMP4(webmBlob: Blob): Promise<Blob> {
    if (!this.ffmpeg) {
      await this.initializeFFmpeg();
    }

    if (!this.ffmpeg) {
      throw new Error('FFmpeg not initialized');
    }

    try {
      console.log('Converting WebM to MP4...');

      // Write input file
      await this.ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

      // Convert to MP4 with good compression settings
      await this.ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',           // Video codec
        '-preset', 'medium',         // Encoding speed vs compression
        '-crf', '23',               // Quality (lower = better quality)
        '-c:a', 'aac',              // Audio codec
        '-b:a', '128k',             // Audio bitrate
        '-movflags', '+faststart',   // Web optimization
        'output.mp4'
      ]);

      // Read output file
      const mp4Data = await this.ffmpeg.readFile('output.mp4');
      const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' });

      // Cleanup FFmpeg files
      await this.ffmpeg.deleteFile('input.webm');
      await this.ffmpeg.deleteFile('output.mp4');

      console.log('MP4 conversion complete. Size:', mp4Blob.size);
      return mp4Blob;
    } catch (error) {
      console.error('FFmpeg conversion failed:', error);
      throw error;
    }
  }

  private cleanup(): void {
    // Stop all tracks
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach(track => track.stop());
      this.canvasStream = null;
    }

    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(track => track.stop());
      this.combinedStream = null;
    }

    // Reset recorder
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  async dispose(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    }
    this.cleanup();
    
    if (this.ffmpeg) {
      // FFmpeg cleanup if needed
      this.ffmpeg = null;
    }
  }
}
