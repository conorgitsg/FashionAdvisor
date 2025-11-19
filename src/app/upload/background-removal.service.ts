import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BackgroundRemovalService {
  async removeBackground(blob: Blob): Promise<Blob> {
    // TODO: Implement background removal
    // For now, return the original blob
    return blob;
  }
}
