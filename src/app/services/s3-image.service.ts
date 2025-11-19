import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UploadResponse {
  url: string;
  key: string;
  filename: string;
}

export interface ImageMetadata {
  key: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
}

@Injectable({
  providedIn: 'root'
})
export class S3ImageService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/images`;

  /**
   * Upload an image file to S3 via backend
   */
  uploadImage(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('image', file, file.name);

    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get a pre-signed URL for direct upload to S3
   */
  getPresignedUploadUrl(filename: string, contentType: string): Observable<PresignedUrlResponse> {
    return this.http.post<PresignedUrlResponse>(`${this.apiUrl}/presigned-url`, {
      filename,
      contentType
    }).pipe(catchError(this.handleError));
  }

  /**
   * Upload directly to S3 using a pre-signed URL
   */
  uploadToPresignedUrl(presignedUrl: string, file: File): Observable<void> {
    return this.http.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    }).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  /**
   * Get image metadata by key
   */
  getImageMetadata(key: string): Observable<ImageMetadata> {
    return this.http.get<ImageMetadata>(`${this.apiUrl}/${encodeURIComponent(key)}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * List all images with optional pagination
   */
  listImages(limit = 20, continuationToken?: string): Observable<{ images: ImageMetadata[]; nextToken?: string }> {
    const params: Record<string, string> = { limit: limit.toString() };
    if (continuationToken) {
      params['continuationToken'] = continuationToken;
    }

    return this.http.get<{ images: ImageMetadata[]; nextToken?: string }>(`${this.apiUrl}`, { params })
      .pipe(catchError(this.handleError));
  }

  /**
   * Delete an image by key
   */
  deleteImage(key: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${encodeURIComponent(key)}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Get a signed URL for viewing a private image
   */
  getSignedViewUrl(key: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/${encodeURIComponent(key)}/signed-url`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred while processing the image request';

    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else if (error.status === 413) {
      errorMessage = 'Image file is too large';
    } else if (error.status === 415) {
      errorMessage = 'Unsupported image format';
    } else if (error.status === 404) {
      errorMessage = 'Image not found';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    return throwError(() => new Error(errorMessage));
  }
}
