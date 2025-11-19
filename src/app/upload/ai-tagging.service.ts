import { Injectable } from '@angular/core';

export interface AiTagResult {
  category: string;
  color: string;
  style: string;
  tags: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AiTaggingService {
  async analyzeImage(blob: Blob): Promise<AiTagResult> {
    // TODO: Implement AI tagging via backend
    // For now, return placeholder result
    return {
      category: 'Unknown',
      color: 'Unknown',
      style: 'Unknown',
      tags: []
    };
  }
}
