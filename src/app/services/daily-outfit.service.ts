import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

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
  source?: 'existing' | 'new';
}

@Injectable({
  providedIn: 'root'
})
export class DailyOutfitService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDailyOutfit(strategy: 'existing' | 'new' = 'existing'): Observable<DailyOutfitResponse> {
    return this.fetchWeatherAndOutfit(strategy);
  }

  getOutfitByPreferences(tags: string[]): Observable<DailyOutfitResponse> {
    return this.fetchWeatherAndOutfit('new', tags);
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

  private fetchWeatherAndOutfit(strategy: 'existing' | 'new', tags?: string[]): Observable<DailyOutfitResponse> {
    return this.getWeather().pipe(
      switchMap(weather =>
        this.http.post<DailyOutfitResponse>(`${this.apiUrl}/stylist/daily`, {
          strategy,
          tags,
          weather
        }).pipe(
          map(response => ({
            ...response,
            weather: response.weather || weather
          }))
        )
      ),
      catchError((err) => {
        console.error('Failed to fetch daily outfit', err);
        return of({
          weather: {
            temperature: 28,
            feelsLike: 30,
            condition: 'Partly Cloudy',
            icon: 'partly-cloudy',
            rainChance: 20
          },
          mainOutfit: {
            id: 'fallback',
            items: [],
            reason: 'Unable to load outfit right now. Please try again shortly.'
          },
          alternatives: []
        });
      })
    );
  }

  markAsWorn(outfitId: string): Observable<{ success: boolean }> {
    return of({ success: true });
  }
}
