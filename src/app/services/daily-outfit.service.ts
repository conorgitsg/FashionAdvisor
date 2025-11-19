import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, map, catchError, switchMap } from 'rxjs';

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
    return this.getWeather().pipe(
      map(weather => this.generateOutfitForWeather(weather))
    );
  }

  getOutfitByPreferences(tags: string[]): Observable<DailyOutfitResponse> {
    return this.getWeather().pipe(
      map(weather => this.generateOutfitForWeather(weather, tags))
    );
  }

  private getWeather(): Observable<WeatherInfo> {
    // Use Open-Meteo API (free, no API key required)
    // Default to Singapore coordinates
    const lat = 1.3521;
    const lon = 103.8198;

    return this.http.get<any>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`
    ).pipe(
      map(response => {
        const current = response.current;
        const weatherCode = current.weather_code;

        return {
          temperature: Math.round(current.temperature_2m),
          feelsLike: Math.round(current.apparent_temperature),
          condition: this.getConditionFromCode(weatherCode),
          icon: this.getIconFromCode(weatherCode),
          rainChance: this.getRainChanceFromCode(weatherCode)
        };
      }),
      catchError(() => {
        // Fallback to mock data if API fails
        return of({
          temperature: 28,
          feelsLike: 30,
          condition: 'Partly Cloudy',
          icon: 'partly-cloudy',
          rainChance: 20
        });
      })
    );
  }

  private getConditionFromCode(code: number): string {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 49) return 'Foggy';
    if (code <= 69) return 'Rainy';
    if (code <= 79) return 'Snowy';
    if (code <= 99) return 'Stormy';
    return 'Cloudy';
  }

  private getIconFromCode(code: number): string {
    if (code === 0) return 'sunny';
    if (code <= 3) return 'partly-cloudy';
    if (code <= 49) return 'cloudy';
    if (code <= 69) return 'rainy';
    if (code <= 79) return 'snowy';
    if (code <= 99) return 'stormy';
    return 'cloudy';
  }

  private getRainChanceFromCode(code: number): number {
    if (code === 0) return 0;
    if (code <= 3) return 10;
    if (code <= 49) return 30;
    if (code <= 69) return 70;
    if (code <= 99) return 90;
    return 20;
  }

  private generateOutfitForWeather(weather: WeatherInfo, tags?: string[]): DailyOutfitResponse {
    const tagNote = tags && tags.length > 0 ? ` Based on your preferences: ${tags.join(', ')}.` : '';

    // Generate outfit recommendations based on weather
    let mainOutfit: OutfitRecommendation;
    let alternatives: OutfitRecommendation[];

    const isHot = weather.temperature >= 28;
    const isWarm = weather.temperature >= 22 && weather.temperature < 28;
    const isCool = weather.temperature >= 15 && weather.temperature < 22;
    const isCold = weather.temperature < 15;
    const isRainy = weather.rainChance && weather.rainChance > 50;

    if (isHot) {
      mainOutfit = {
        id: 'outfit-hot-1',
        items: [
          { id: 'item-1', name: 'Light Cotton T-Shirt', type: 'top', imageUrl: '/assets/placeholder-top.png', color: 'white' },
          { id: 'item-2', name: 'Linen Shorts', type: 'bottom', imageUrl: '/assets/placeholder-bottom.png', color: 'beige' },
          { id: 'item-3', name: 'Breathable Sneakers', type: 'shoes', imageUrl: '/assets/placeholder-shoes.png', color: 'white' }
        ],
        reason: `At ${weather.temperature}°C (feels like ${weather.feelsLike}°C), lightweight breathable fabrics are essential. This cotton and linen combo keeps you cool.${tagNote}`
      };
      alternatives = [
        {
          id: 'outfit-hot-2',
          items: [
            { id: 'item-4', name: 'Sleeveless Blouse', type: 'top', imageUrl: '/assets/placeholder-top.png', color: 'light-blue' },
            { id: 'item-5', name: 'Flowy Midi Skirt', type: 'bottom', imageUrl: '/assets/placeholder-bottom.png', color: 'white' }
          ],
          reason: 'A breezy option for maximum airflow.',
          isAlternative: true
        },
        {
          id: 'outfit-hot-3',
          items: [
            { id: 'item-6', name: 'Linen Button-Down', type: 'top', imageUrl: '/assets/placeholder-top.png', color: 'cream' },
            { id: 'item-7', name: 'Chino Shorts', type: 'bottom', imageUrl: '/assets/placeholder-bottom.png', color: 'navy' }
          ],
          reason: 'Smart casual while staying cool.',
          isAlternative: true
        }
      ];
    } else if (isRainy) {
      mainOutfit = {
        id: 'outfit-rainy-1',
        items: [
          { id: 'item-1', name: 'Water-Resistant Jacket', type: 'top', imageUrl: '/assets/placeholder-top.png', color: 'navy' },
          { id: 'item-2', name: 'Dark Jeans', type: 'bottom', imageUrl: '/assets/placeholder-bottom.png', color: 'dark-blue' },
          { id: 'item-3', name: 'Waterproof Boots', type: 'shoes', imageUrl: '/assets/placeholder-shoes.png', color: 'black' }
        ],
        reason: `${weather.rainChance}% chance of rain today. This water-resistant outfit will keep you dry and comfortable at ${weather.temperature}°C.${tagNote}`
      };
      alternatives = [
        {
          id: 'outfit-rainy-2',
          items: [
            { id: 'item-4', name: 'Trench Coat', type: 'top', imageUrl: '/assets/placeholder-top.png', color: 'beige' },
            { id: 'item-5', name: 'Black Pants', type: 'bottom', imageUrl: '/assets/placeholder-bottom.png', color: 'black' }
          ],
          reason: 'Classic rainy day elegance.',
          isAlternative: true
        }
      ];
    } else {
      // Warm/moderate weather
      mainOutfit = {
        id: 'outfit-warm-1',
        items: [
          { id: 'item-1', name: 'White Linen Blouse', type: 'top', imageUrl: '/assets/placeholder-top.png', color: 'white' },
          { id: 'item-2', name: 'Navy Chinos', type: 'bottom', imageUrl: '/assets/placeholder-bottom.png', color: 'navy' },
          { id: 'item-3', name: 'White Sneakers', type: 'shoes', imageUrl: '/assets/placeholder-shoes.png', color: 'white' }
        ],
        reason: `Perfect for today's ${weather.temperature}°C weather. The breathable linen keeps you comfortable while the chinos maintain a polished look.${tagNote}`
      };
      alternatives = [
        {
          id: 'outfit-warm-2',
          items: [
            { id: 'item-4', name: 'Light Blue T-Shirt', type: 'top', imageUrl: '/assets/placeholder-top.png', color: 'light-blue' },
            { id: 'item-5', name: 'Beige Shorts', type: 'bottom', imageUrl: '/assets/placeholder-bottom.png', color: 'beige' }
          ],
          reason: 'A more casual option.',
          isAlternative: true
        },
        {
          id: 'outfit-warm-3',
          items: [
            { id: 'item-6', name: 'Striped Button-Down', type: 'top', imageUrl: '/assets/placeholder-top.png', color: 'striped' },
            { id: 'item-7', name: 'Dark Jeans', type: 'bottom', imageUrl: '/assets/placeholder-bottom.png', color: 'dark-blue' }
          ],
          reason: 'Smart casual for meetings.',
          isAlternative: true
        }
      ];
    }

    return {
      weather,
      mainOutfit,
      alternatives
    };
  }

  markAsWorn(outfitId: string): Observable<{ success: boolean }> {
    // TODO: Replace with actual API call
    // return this.http.post<{ success: boolean }>(`${this.apiUrl}/outfits/${outfitId}/wear`, {});

    return of({ success: true });
  }
}
