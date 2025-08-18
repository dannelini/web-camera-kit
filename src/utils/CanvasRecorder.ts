import { VideoProcessor } from "./VideoProcessor";
import settings from "./cameraKitSettings";
import { getMediaExtension } from "./cameraKitHelpers";

export class CanvasRecorder {
  private canvas: HTMLCanvasElement;
  private recordedBlobs: Blob[];
  private mediaRecorder: MediaRecorder | null;
  private recordStream: MediaStream | null;
  private supportedCodec: string | null;
  private recordExtension: string | null;
  private recordFormat: string;
  private VideoProcessor: VideoProcessor | null;
  private showDebug: boolean;
  private canvasStream: MediaStream;
  private video: HTMLVideoElement;

  constructor(canvas: HTMLCanvasElement, audioStreams: MediaStream[]) {
    // Check if required APIs are supported
    if (!navigator.mediaDevices || !MediaRecorder || !canvas.captureStream) {
      throw new Error('Your browser does not support the required recording features');
    }

    this.canvas = canvas;
    this.recordedBlobs = [];
    this.mediaRecorder = null;
    this.recordStream = null;
    this.supportedCodec = null;
    this.recordExtension = null;
    this.recordFormat = "";

    if (settings.processVideoWithFFmpeg) {
      this.VideoProcessor = new VideoProcessor();
    } else {
      this.VideoProcessor = null;
    }

    this.showDebug = settings.showDebugLog;

    try {
      // Get canvas stream
      this.canvasStream = canvas.captureStream(settings.recordVideoFrameRate); // Specify framerate explicitly

      // mix audio streams
      const mixAudioContext = new AudioContext();
      const mixDestination = mixAudioContext.createMediaStreamDestination();

      for (let i = 0; i < audioStreams.length; i++) {
        const newStream = mixAudioContext.createMediaStreamSource(audioStreams[i]);
        newStream.connect(mixDestination);
      }

      const audioTracks = [];
      for (let i = 0; i < audioStreams.length; i++) {
        audioTracks.push(...audioStreams[i].getAudioTracks());
      }

      console.log('Recording Audio Tracks:');
      console.log(audioTracks);

      this.recordStream = new MediaStream();
      this.recordStream.addTrack(this.canvasStream.getVideoTracks()[0]);
      this.recordStream.addTrack(mixDestination.stream.getAudioTracks()[0]);

      if (!this.recordStream) {
        throw new Error('Failed to create stream');
      }
    } catch (e) {
      console.error('Stream creation failed:', e);
      throw new Error('Failed to initialize canvas stream');
    }

    this.video = document.createElement('video');
    this.video.style.display = 'none';
  }

  start(): void {
    // Prioritize more widely supported codecs first
    const types = settings.recodeVideoCodecs;
    let foundTypes = false;

    console.log("== Check Supported Types ==");
    // log all supported formats
    for (let i = 0; i < types.length; i++) {
      const targetCodec = types[i].codecString;
      console.log(`Codec: ${targetCodec} - ${MediaRecorder.isTypeSupported(targetCodec)}`);

      if (foundTypes === false && MediaRecorder.isTypeSupported(targetCodec)) {
        foundTypes = true;
        this.supportedCodec = types[i].codecString;
        this.recordFormat = types[i].container;

        console.log("found type!");
      }
    }

    console.log('Using MIME type:', this.supportedCodec);

    if (!this.supportedCodec) {
      throw new Error("No supported video format found");
    }

    const options = {
      mimeType: this.supportedCodec,
      videoBitsPerSecond: settings.recordVideoBitsPerSecond || 2500000,
      audioBitsPerSecond: settings.recordAudioBitsPerSecond || 256000,
    };

    try {
      this.mediaRecorder = new MediaRecorder(this.recordStream!, options);
    } catch (e) {
      console.error('MediaRecorder creation failed:', e);
      throw new Error('Failed to create MediaRecorder');
    }

    this.recordedBlobs = [];
    this.mediaRecorder.onstop = this.handleStop.bind(this);
    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
    };
    this.mediaRecorder.ondataavailable = this.handleDataAvailable.bind(this);

    try {
      this.mediaRecorder.start(1000);
    } catch (e) {
      console.error('MediaRecorder start failed:', e);
      throw new Error('Failed to start recording');
    }
  }

  private handleDataAvailable(event: BlobEvent): void {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  }

  private handleStop(event: Event): void {
    console.log('Recorder stopped: ', event);
    const superBuffer = new Blob(this.recordedBlobs, { type: this.supportedCodec! });
    this.video.src = window.URL.createObjectURL(superBuffer);
  }

  stop(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.requestData();
      this.mediaRecorder.stop();
    }

    console.log('Recorded Blobs: ' + this.recordedBlobs);
    this.video.controls = true;
  }

  async share(fileName?: string): Promise<void> {
    let name = fileName || 'recording';

    // if the name has extension, remove it
    if (name.includes('.')) {
      name = name.split('.')[0];
    }

    // add the extension
    name += "." + this.recordFormat;

    // remove codecs
    const shareFileType = this.supportedCodec!.split(';')[0];

    const resultFile = new File([this.recordedBlobs], name, { type: shareFileType });

    const shareData = {
      files: [resultFile],
      title: 'Share Recording',
      text: 'Check out my recording!'
    };

    if (navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData).catch((error) => {
        console.error('Sharing failed:', error);
        this.save(fileName);
      });
    } else {
      this.save(fileName);
    }
  }

  async save(fileName?: string): Promise<void> {
    const name = fileName || 'recording';
    let saveBlob = new Blob(this.recordedBlobs, { type: this.supportedCodec! });

    if (settings.processVideoWithFFmpeg && this.VideoProcessor) {
      const processedBlob = await this.VideoProcessor.processVideo(saveBlob, this.supportedCodec!);
      saveBlob = processedBlob;
    }

    const resultExtension = getMediaExtension(saveBlob.type);

    const url = window.URL.createObjectURL(saveBlob);
    const a = document.createElement('a');

    const fileFullName = `${name}.${resultExtension}`;

    console.log(fileFullName);

    a.style.display = 'none';
    a.href = url;
    a.download = fileFullName;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Takes a snapshot of the current canvas and returns it as a Blob
   * @param format - The image format (default: 'image/png')
   * @param quality - The image quality for JPEG format (0-1)
   * @returns A promise that resolves with the image Blob
   */
  async snapshot(format = 'image/png', quality = 1.0): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Convert canvas to blob
        this.canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create snapshot'));
          }
        }, format, quality);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Takes a snapshot and saves it as a file
   * @param fileName - The name of the file (without extension)
   * @param format - The image format (default: 'image/png')
   * @param quality - The image quality for JPEG format (0-1)
   */
  async saveSnapshot(fileName = 'snapshot', format = 'image/png', quality = 1.0): Promise<void> {
    try {
      const blob = await this.snapshot(format, quality);
      const extension = format.split('/')[1];
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.style.display = 'none';
      a.href = url;
      a.download = `${fileName}.${extension}`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      throw error;
    }
  }
}
