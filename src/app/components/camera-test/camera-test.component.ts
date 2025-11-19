import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraCaptureComponent } from '../../camera/camera-capture.component';
import { S3ImageService, ImageMetadata } from '../../services/s3-image.service';

interface UploadedImage {
  key: string;
  url: string;
  filename: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-camera-test',
  standalone: true,
  imports: [CommonModule, CameraCaptureComponent],
  templateUrl: './camera-test.component.html',
  styleUrls: ['./camera-test.component.css']
})
export class CameraTestComponent implements OnInit {
  private readonly s3Service = inject(S3ImageService);

  uploadedImages = signal<UploadedImage[]>([]);
  lastCaptureTime = signal<string | null>(null);
  captureCount = signal(0);
  isUploading = signal(false);
  uploadError = signal<string | null>(null);
  isLoading = signal(false);

  ngOnInit(): void {
    this.loadImages();
  }

  loadImages(): void {
    this.isLoading.set(true);
    this.s3Service.listImages(50).subscribe({
      next: (response) => {
        const images = response.images.map(img => ({
          key: img.key,
          url: img.url,
          filename: img.filename,
          uploadedAt: img.uploadedAt
        }));
        this.uploadedImages.set(images);
        this.captureCount.set(images.length);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load images:', err);
        this.isLoading.set(false);
      }
    });
  }

  onPhotoCaptured(blob: Blob): void {
    this.uploadError.set(null);
    this.isUploading.set(true);

    // Create a File from the Blob
    const filename = `camera-${Date.now()}.jpg`;
    const file = new File([blob], filename, { type: 'image/jpeg' });

    this.s3Service.uploadImage(file).subscribe({
      next: (response) => {
        const newImage: UploadedImage = {
          key: response.key,
          url: response.url,
          filename: response.filename,
          uploadedAt: new Date().toISOString()
        };
        this.uploadedImages.update(images => [newImage, ...images]);
        this.captureCount.update(count => count + 1);
        this.lastCaptureTime.set(new Date().toLocaleTimeString());
        this.isUploading.set(false);

        console.log('Photo uploaded to S3:', {
          key: response.key,
          url: response.url,
          timestamp: new Date().toISOString()
        });
      },
      error: (err) => {
        console.error('Upload failed:', err);
        this.uploadError.set(err.message || 'Failed to upload image');
        this.isUploading.set(false);
      }
    });
  }

  deleteImage(image: UploadedImage): void {
    this.s3Service.deleteImage(image.key).subscribe({
      next: () => {
        this.uploadedImages.update(images =>
          images.filter(img => img.key !== image.key)
        );
        this.captureCount.update(count => Math.max(0, count - 1));
      },
      error: (err) => {
        console.error('Delete failed:', err);
        this.uploadError.set(err.message || 'Failed to delete image');
      }
    });
  }

  clearAllImages(): void {
    const images = this.uploadedImages();
    if (images.length === 0) return;

    // Delete all images from S3
    images.forEach(image => {
      this.s3Service.deleteImage(image.key).subscribe({
        error: (err) => console.error('Failed to delete:', image.key, err)
      });
    });

    this.uploadedImages.set([]);
    this.captureCount.set(0);
    this.lastCaptureTime.set(null);
  }

  refreshImages(): void {
    this.loadImages();
  }
}
