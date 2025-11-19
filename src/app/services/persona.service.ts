import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface PersonaProfile {
  name: string;
  ageRange: string;
  genderPresentation: string;
  height: number;
  heightUnit: string;
  weight: number | null;
  shareWeight: boolean;
  bodyShape: string;
  fitPreference: number;
  styles: string[];
  colors: string[];
  patternsToAvoid: string[];
  location: string;
  activities: string[];
  weatherSensitivity: string;
  goals: string[];
}

export interface PersonaResponse {
  id: string;
  userId: string | null;
  profile: PersonaProfile;
}

@Injectable({ providedIn: 'root' })
export class PersonaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/personas`;

  savePersona(profile: PersonaProfile, userId?: string): Observable<PersonaResponse> {
    return this.http.post<PersonaResponse>(this.apiUrl, { profile, userId });
  }

  updatePersona(id: string, profile: PersonaProfile, userId?: string): Observable<PersonaResponse> {
    return this.http.put<PersonaResponse>(`${this.apiUrl}/${id}`, { profile, userId });
  }
}
