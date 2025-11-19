import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { S3ImageService, ImageMetadata } from '../../services/s3-image.service';

@Component({
  selector: 'app-s3-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './s3-test.component.html',
  styleUrl: './s3-test.component.css'
})
export class S3TestComponent {
  private readonly s3Service = inject(S3ImageService);

  protected readonly status = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  protected readonly message = signal('');
  protected readonly images = signal<ImageMetadata[]>([]);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly uploadProgress = signal('');

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.message.set(`Selected: ${input.files[0].name}`);
    }
  }

  testConnection(): void {
    this.status.set('loading');
    this.message.set('Testing connection to S3 backend...');

    this.s3Service.listImages(5).subscribe({
      next: (response) => {
        this.status.set('success');
        this.images.set(response.images);
        this.message.set(`Connection successful! Found ${response.images.length} images.`);
      },
      error: (error) => {
        this.status.set('error');
        this.message.set(`Connection failed: ${error.message}`);
      }
    });
  }

  uploadImage(): void {
    const file = this.selectedFile();
    if (!file) {
      this.message.set('Please select a file first');
      return;
    }

    this.status.set('loading');
    this.uploadProgress.set('Uploading...');

    this.s3Service.uploadImage(file).subscribe({
      next: (response) => {
        this.status.set('success');
        this.uploadProgress.set('');
        this.message.set(`Upload successful! URL: ${response.url}`);
        this.selectedFile.set(null);
        // Refresh the image list
        this.testConnection();
      },
      error: (error) => {
        this.status.set('error');
        this.uploadProgress.set('');
        this.message.set(`Upload failed: ${error.message}`);
      }
    });
  }

  deleteImage(key: string): void {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    this.status.set('loading');
    this.message.set('Deleting image...');

    this.s3Service.deleteImage(key).subscribe({
      next: () => {
        this.status.set('success');
        this.message.set('Image deleted successfully');
        this.testConnection();
      },
      error: (error) => {
        this.status.set('error');
        this.message.set(`Delete failed: ${error.message}`);
      }
    });
  }
}
