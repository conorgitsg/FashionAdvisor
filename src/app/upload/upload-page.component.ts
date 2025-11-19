import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraCaptureComponent } from '../camera/camera-capture.component';
import { BackgroundRemovalService } from './background-removal.service';
import { AiTaggingService, AiTagResult } from './ai-tagging.service';

type UploadMode = 'camera' | 'file';
type UploadStatus = 'idle' | 'processing' | 'done' | 'error';

@Component({
  selector: 'app-upload-page',
  standalone: true,
  imports: [CommonModule, CameraCaptureComponent],
  templateUrl: './upload-page.component.html',
  styleUrls: ['./upload-page.component.css'],
})
export class UploadPageComponent implements OnDestroy {
  mode: UploadMode = 'camera';
  status: UploadStatus = 'idle';
  statusMessage: string | null = null;

  rawBlob: Blob | null = null;
  processedBlob: Blob | null = null;

  rawPreviewUrl: string | null = null;
  processedPreviewUrl: string | null = null;

  aiResult: AiTagResult | null = null;

  constructor(
    private backgroundRemoval: BackgroundRemovalService,
    private aiTagging: AiTaggingService
  ) {}

  ngOnDestroy(): void {
    this.revokePreviews();
  }

  switchMode(mode: UploadMode): void {
    this.mode = mode;
    this.clearState();
  }

  onPhotoCaptured(blob: Blob): void {
    this.startPipeline(blob);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    this.startPipeline(file);
    // Reset the input so selecting the same file again still triggers change
    input.value = '';
  }

  private revokePreviews(): void {
    if (this.rawPreviewUrl) {
      URL.revokeObjectURL(this.rawPreviewUrl);
      this.rawPreviewUrl = null;
    }
    if (this.processedPreviewUrl) {
      URL.revokeObjectURL(this.processedPreviewUrl);
      this.processedPreviewUrl = null;
    }
  }

  private clearState(): void {
    this.status = 'idle';
    this.statusMessage = null;
    this.rawBlob = null;
    this.processedBlob = null;
    this.aiResult = null;
    this.revokePreviews();
  }

  async startPipeline(blob: Blob): Promise<void> {
    this.clearState();
    this.rawBlob = blob;

    // Show the "original" preview immediately
    this.rawPreviewUrl = URL.createObjectURL(blob);

    this.status = 'processing';
    this.statusMessage = 'Removing background…';

    try {
      // STEP 1: Background removal
      const processed = await this.backgroundRemoval.removeBackground(blob);
      this.processedBlob = processed;
      this.processedPreviewUrl = URL.createObjectURL(processed);

      // STEP 2: AI tagging
      this.statusMessage = 'Analyzing item with AI stylist…';
      this.aiResult = await this.aiTagging.analyzeImage(processed);

      this.status = 'done';
      this.statusMessage =
        'Item analyzed. Ready to save to your wardrobe (once backend is wired).';
    } catch (err) {
      console.error('Error in upload pipeline', err);
      this.status = 'error';
      this.statusMessage =
        'Something went wrong while processing the image. Please try again.';
    }
  }
}
