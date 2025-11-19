import { Component, signal } from '@angular/core';
import { CameraCaptureComponent } from '../../camera/camera-capture.component';

@Component({
  selector: 'app-camera-test',
  standalone: true,
  imports: [CameraCaptureComponent],
  templateUrl: './camera-test.component.html',
  styleUrls: ['./camera-test.component.css']
})
export class CameraTestComponent {
  capturedImages = signal<string[]>([]);
  lastCaptureTime = signal<string | null>(null);
  captureCount = signal(0);

  onPhotoCaptured(blob: Blob): void {
    // Convert blob to data URL for display
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.capturedImages.update(images => [...images, dataUrl]);
      this.captureCount.update(count => count + 1);
      this.lastCaptureTime.set(new Date().toLocaleTimeString());
    };
    reader.readAsDataURL(blob);

    console.log('Photo captured:', {
      size: blob.size,
      type: blob.type,
      timestamp: new Date().toISOString()
    });
  }

  clearImages(): void {
    this.capturedImages.set([]);
    this.captureCount.set(0);
    this.lastCaptureTime.set(null);
  }
}
