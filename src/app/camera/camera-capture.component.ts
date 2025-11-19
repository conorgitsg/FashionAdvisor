import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-camera-capture',
  standalone: true,
  templateUrl: './camera-capture.component.html',
  styleUrls: ['./camera-capture.component.css'],
})
export class CameraCaptureComponent implements OnInit, OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Output() photoCaptured = new EventEmitter<Blob>();

  isCameraActive = false;
  hasCaptured = false;
  errorMessage: string | null = null;
  capturedDataUrl: string | null = null;
  private capturedBlob: Blob | null = null;

  private mediaStream: MediaStream | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    // We don't auto-start the camera to avoid permission popups on load.
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  async startCamera(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.errorMessage = 'Camera not supported on this device or browser.';
      return;
    }

    this.errorMessage = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // use back camera when available
        },
        audio: false,
      });

      this.mediaStream = stream;
      this.isCameraActive = true;
      this.hasCaptured = false;
      this.capturedDataUrl = null;

      // Wait for the view to update so videoRef is available
      this.cdr.detectChanges();

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 50));

      if (this.videoRef) {
        const video = this.videoRef.nativeElement;
        video.srcObject = stream;
        await video.play();
      } else {
        throw new Error('Video element not available');
      }
    } catch (err) {
      console.error('Error starting camera', err);
      this.errorMessage = 'Unable to access camera. Please check permissions.';
      this.isCameraActive = false;
    }
  }

  capturePhoto(): void {
    if (!this.isCameraActive || !this.videoRef || !this.canvasRef) {
      return;
    }

    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      this.errorMessage = 'Camera is not ready yet. Please try again.';
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.errorMessage = 'Could not access drawing context.';
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    this.capturedDataUrl = dataUrl;
    this.hasCaptured = true;

    // Convert to Blob and emit for upload pipeline
    canvas.toBlob((blob) => {
      if (blob) {
        this.capturedBlob = blob;
        this.photoCaptured.emit(blob);
      }
    }, 'image/jpeg', 0.9);
  }

  async retake(): Promise<void> {
    this.hasCaptured = false;
    this.capturedDataUrl = null;
    this.errorMessage = null;

    if (!this.mediaStream) {
      await this.startCamera();
    }
  }

  usePhoto(): void {
    if (this.capturedBlob) {
      this.photoCaptured.emit(this.capturedBlob);
    } else {
      console.warn('No captured photo to use.');
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.isCameraActive = false;
  }
}
