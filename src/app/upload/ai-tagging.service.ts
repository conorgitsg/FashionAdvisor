import { Injectable } from '@angular/core';

export interface AiTagResult {
  category: string;
  colors: string[];
  seasons: string[];
  occasions: string[];
  pattern: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiTaggingService {
  /**
   * Placeholder implementation.
   *
   * Later, this is where you'll:
   *  - Send the image (or its URL) to your backend
   *  - Call your AI Vision / LLM stack
   *  - Parse the response into this AiTagResult shape
   */
  async analyzeImage(file: Blob): Promise<AiTagResult> {
    console.log('Stub AI tagging received file of size:', file.size);

    // TODO: Replace with real AI integration.
    // Hard-coded placeholder values to prove the flow works.
    return {
      category: 'Unknown item (stub)',
      colors: ['unspecified'],
      seasons: ['all-season'],
      occasions: ['everyday'],
      pattern: 'unknown',
      notes:
        'This is a stub result. Once AI integration is wired, you will see real tags here.',
    };
  }
}
