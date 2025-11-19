import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WardrobeTags {
  item_name: string;
  broad_category: string;
  sub_category: string;
  silhouette: string;
  materials: string;
  colors: string[];
  patterns: string;
  construction_details: string;
  style_vibe: string;
  best_pairings: string[];
  seasonality: string[];
  tags: string[];
}

export interface WardrobeTagResponse {
  itemId: string;
  s3Key: string;
  imageUrl: string;
  tags: WardrobeTags;
  rawGpt?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AiTaggingService {
  private readonly http = inject(HttpClient);

  /**
   * Send the clothing image to the backend tagging endpoint.
   * The backend handles background removal, uploads to S3, and calls OpenAI Vision with the standard prompt.
   */
  async analyzeImage(file: Blob): Promise<WardrobeTagResponse> {
    const preparedFile =
      file instanceof File
        ? file
        : new File([file], 'wardrobe-item.jpg', {
          type: (file as Blob).type || 'image/jpeg',
        });

    const formData = new FormData();
    formData.append('image', preparedFile, preparedFile.name);

    try {
      return await firstValueFrom(
        this.http.post<WardrobeTagResponse>(
          `${environment.apiUrl}/wardrobe/items/tag`,
          formData
        )
      );
    } catch (error) {
      const message =
        error instanceof HttpErrorResponse && error.error?.message
          ? error.error.message
          : 'Tagging failed. Please try again.';
      throw new Error(message);
    }
  }
}
