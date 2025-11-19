import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface WeatherInfo {
  temperature: number;
  feelsLike: number;
  condition: string;
  icon: string;
  rainChance?: number;
}

export interface OutfitItem {
  id: string;
  name: string;
  type: 'top' | 'bottom' | 'shoes' | 'accessory';
  imageUrl: string;
  color?: string;
}

export interface OutfitRecommendation {
  id: string;
  items: OutfitItem[];
  reason: string;
  isAlternative?: boolean;
}

export interface DailyOutfitResponse {
  weather: WeatherInfo;
  mainOutfit: OutfitRecommendation;
  alternatives: OutfitRecommendation[];
}

@Injectable({
  providedIn: 'root'
})
export class DailyOutfitService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getDailyOutfit(): Observable<DailyOutfitResponse> {
    // TODO: Replace with actual API call
    // return this.http.get<DailyOutfitResponse>(`${this.apiUrl}/daily-outfit`);

    // Mock data for now
    return of(this.getMockData());
  }

  getOutfitByPreferences(tags: string[]): Observable<DailyOutfitResponse> {
    // TODO: Replace with actual API call
    // return this.http.post<DailyOutfitResponse>(`${this.apiUrl}/daily-outfit/preferences`, { tags });

    // Mock data for now
    return of(this.getMockData(tags));
  }

  markAsWorn(outfitId: string): Observable<{ success: boolean }> {
    // TODO: Replace with actual API call
    // return this.http.post<{ success: boolean }>(`${this.apiUrl}/outfits/${outfitId}/wear`, {});

    return of({ success: true });
  }

  private getMockData(tags?: string[]): DailyOutfitResponse {
    const tagNote = tags && tags.length > 0 ? ` Based on your preferences: ${tags.join(', ')}.` : '';

    return {
      weather: {
        temperature: 24,
        feelsLike: 26,
        condition: 'Partly Cloudy',
        icon: 'partly-cloudy',
        rainChance: 20
      },
      mainOutfit: {
        id: 'outfit-1',
        items: [
          {
            id: 'item-1',
            name: 'White Linen Blouse',
            type: 'top',
            imageUrl: '/assets/placeholder-top.png',
            color: 'white'
          },
          {
            id: 'item-2',
            name: 'Navy Chinos',
            type: 'bottom',
            imageUrl: '/assets/placeholder-bottom.png',
            color: 'navy'
          },
          {
            id: 'item-3',
            name: 'White Sneakers',
            type: 'shoes',
            imageUrl: '/assets/placeholder-shoes.png',
            color: 'white'
          }
        ],
        reason: `This breathable linen top is perfect for today's warm weather, while the navy chinos keep it polished.${tagNote}`
      },
      alternatives: [
        {
          id: 'outfit-2',
          items: [
            {
              id: 'item-4',
              name: 'Light Blue T-Shirt',
              type: 'top',
              imageUrl: '/assets/placeholder-top.png',
              color: 'light-blue'
            },
            {
              id: 'item-5',
              name: 'Beige Shorts',
              type: 'bottom',
              imageUrl: '/assets/placeholder-bottom.png',
              color: 'beige'
            }
          ],
          reason: 'A more casual option for the warm weather.',
          isAlternative: true
        },
        {
          id: 'outfit-3',
          items: [
            {
              id: 'item-6',
              name: 'Striped Button-Down',
              type: 'top',
              imageUrl: '/assets/placeholder-top.png',
              color: 'striped'
            },
            {
              id: 'item-7',
              name: 'Dark Jeans',
              type: 'bottom',
              imageUrl: '/assets/placeholder-bottom.png',
              color: 'dark-blue'
            }
          ],
          reason: 'Smart casual option if you have meetings.',
          isAlternative: true
        },
        {
          id: 'outfit-4',
          items: [
            {
              id: 'item-8',
              name: 'Pastel Pink Top',
              type: 'top',
              imageUrl: '/assets/placeholder-top.png',
              color: 'pink'
            },
            {
              id: 'item-9',
              name: 'White Linen Pants',
              type: 'bottom',
              imageUrl: '/assets/placeholder-bottom.png',
              color: 'white'
            }
          ],
          reason: 'Light and airy for maximum comfort.',
          isAlternative: true
        }
      ]
    };
  }
}
