import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { S3ImageService, ImageMetadata, UploadResponse, PresignedUrlResponse } from './s3-image.service';

describe('S3ImageService', () => {
  let service: S3ImageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(S3ImageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('uploadImage', () => {
    it('should upload an image file', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockResponse: UploadResponse = {
        url: 'https://bucket.s3.amazonaws.com/test.jpg',
        key: 'images/test.jpg',
        filename: 'test.jpg'
      };

      service.uploadImage(mockFile).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/images/upload');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTruthy();
      req.flush(mockResponse);
    });

    it('should handle upload errors', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      service.uploadImage(mockFile).subscribe({
        error: (error) => {
          expect(error.message).toBe('Image file is too large');
        }
      });

      const req = httpMock.expectOne('/api/images/upload');
      req.flush({ message: 'File too large' }, { status: 413, statusText: 'Payload Too Large' });
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should get a presigned URL for upload', () => {
      const mockResponse: PresignedUrlResponse = {
        uploadUrl: 'https://bucket.s3.amazonaws.com/presigned',
        key: 'images/new-image.jpg'
      };

      service.getPresignedUploadUrl('new-image.jpg', 'image/jpeg').subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/images/presigned-url');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        filename: 'new-image.jpg',
        contentType: 'image/jpeg'
      });
      req.flush(mockResponse);
    });
  });

  describe('uploadToPresignedUrl', () => {
    it('should upload directly to presigned URL', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const presignedUrl = 'https://bucket.s3.amazonaws.com/presigned';

      service.uploadToPresignedUrl(presignedUrl, mockFile).subscribe(response => {
        expect(response).toBeUndefined();
      });

      const req = httpMock.expectOne(presignedUrl);
      expect(req.request.method).toBe('PUT');
      expect(req.request.headers.get('Content-Type')).toBe('image/jpeg');
      req.flush(null);
    });
  });

  describe('getImageMetadata', () => {
    it('should get image metadata by key', () => {
      const mockMetadata: ImageMetadata = {
        key: 'images/test.jpg',
        url: 'https://bucket.s3.amazonaws.com/test.jpg',
        filename: 'test.jpg',
        size: 1024,
        contentType: 'image/jpeg',
        uploadedAt: '2024-01-01T00:00:00Z'
      };

      service.getImageMetadata('images/test.jpg').subscribe(metadata => {
        expect(metadata).toEqual(mockMetadata);
      });

      const req = httpMock.expectOne('/api/images/images%2Ftest.jpg');
      expect(req.request.method).toBe('GET');
      req.flush(mockMetadata);
    });

    it('should handle not found errors', () => {
      service.getImageMetadata('nonexistent').subscribe({
        error: (error) => {
          expect(error.message).toBe('Image not found');
        }
      });

      const req = httpMock.expectOne('/api/images/nonexistent');
      req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('listImages', () => {
    it('should list images with default pagination', () => {
      const mockResponse = {
        images: [
          {
            key: 'images/test.jpg',
            url: 'https://bucket.s3.amazonaws.com/test.jpg',
            filename: 'test.jpg',
            size: 1024,
            contentType: 'image/jpeg',
            uploadedAt: '2024-01-01T00:00:00Z'
          }
        ],
        nextToken: 'token123'
      };

      service.listImages().subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/images?limit=20');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should list images with custom pagination', () => {
      service.listImages(50, 'token123').subscribe();

      const req = httpMock.expectOne('/api/images?limit=50&continuationToken=token123');
      expect(req.request.method).toBe('GET');
      req.flush({ images: [], nextToken: undefined });
    });
  });

  describe('deleteImage', () => {
    it('should delete an image by key', () => {
      service.deleteImage('images/test.jpg').subscribe(response => {
        expect(response).toBeUndefined();
      });

      const req = httpMock.expectOne('/api/images/images%2Ftest.jpg');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getSignedViewUrl', () => {
    it('should get a signed URL for viewing', () => {
      const mockResponse = { url: 'https://bucket.s3.amazonaws.com/signed-view-url' };

      service.getSignedViewUrl('images/private.jpg').subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne('/api/images/images%2Fprivate.jpg/signed-url');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('error handling', () => {
    it('should handle unsupported format errors', () => {
      const mockFile = new File(['test'], 'test.gif', { type: 'image/gif' });

      service.uploadImage(mockFile).subscribe({
        error: (error) => {
          expect(error.message).toBe('Unsupported image format');
        }
      });

      const req = httpMock.expectOne('/api/images/upload');
      req.flush({ message: 'Unsupported format' }, { status: 415, statusText: 'Unsupported Media Type' });
    });

    it('should handle server error messages', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      service.uploadImage(mockFile).subscribe({
        error: (error) => {
          expect(error.message).toBe('Custom server error');
        }
      });

      const req = httpMock.expectOne('/api/images/upload');
      req.flush({ message: 'Custom server error' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });
});
