import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface PlannerEvent {
  id: string;
  title: string;
  time?: string;
  location?: string;
  dressCode?: string;
  notes?: string;
}

export interface OutfitItem {
  id: string;
  name: string;
  type: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
  imageUrl: string;
  color?: string;
}

export interface DayOutfit {
  id: string;
  items: OutfitItem[];
  occasion?: string;
}

export interface PlannerDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  events: PlannerEvent[];
  outfit?: DayOutfit;
  weather?: {
    temperature: number;
    condition: string;
    icon: string;
  };
}

export interface PlannerWeek {
  id: string;
  startDate: Date;
  endDate: Date;
  days: PlannerDay[];
}

@Injectable({
  providedIn: 'root'
})
export class WeeklyPlannerService {

  getCurrentWeek(): Observable<PlannerWeek> {
    const today = new Date();
    const startOfWeek = this.getStartOfWeek(today);
    const days = this.generateWeekDays(startOfWeek);

    return of({
      id: this.generateId(),
      startDate: startOfWeek,
      endDate: new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000),
      days: days
    });
  }

  getWeekByDate(date: Date): Observable<PlannerWeek> {
    const startOfWeek = this.getStartOfWeek(date);
    const days = this.generateWeekDays(startOfWeek);

    return of({
      id: this.generateId(),
      startDate: startOfWeek,
      endDate: new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000),
      days: days
    });
  }

  addEvent(dayDate: Date, event: Omit<PlannerEvent, 'id'>): Observable<PlannerEvent> {
    const newEvent: PlannerEvent = {
      ...event,
      id: this.generateId()
    };
    return of(newEvent);
  }

  updateEvent(eventId: string, updates: Partial<PlannerEvent>): Observable<PlannerEvent> {
    return of({ id: eventId, title: updates.title || '', ...updates } as PlannerEvent);
  }

  deleteEvent(eventId: string): Observable<boolean> {
    return of(true);
  }

  setDayOutfit(dayDate: Date, outfit: DayOutfit): Observable<DayOutfit> {
    return of(outfit);
  }

  suggestOutfit(dayDate: Date, events: PlannerEvent[]): Observable<DayOutfit> {
    // Mock outfit suggestion based on events
    const mockOutfit: DayOutfit = {
      id: this.generateId(),
      items: [
        {
          id: '1',
          name: 'White Blouse',
          type: 'top',
          imageUrl: '/assets/placeholder-top.png',
          color: 'White'
        },
        {
          id: '2',
          name: 'Navy Trousers',
          type: 'bottom',
          imageUrl: '/assets/placeholder-bottom.png',
          color: 'Navy'
        },
        {
          id: '3',
          name: 'Beige Loafers',
          type: 'shoes',
          imageUrl: '/assets/placeholder-shoes.png',
          color: 'Beige'
        }
      ],
      occasion: events[0]?.dressCode || 'Casual'
    };
    return of(mockOutfit);
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    return new Date(d.setDate(diff));
  }

  private generateWeekDays(startDate: Date): PlannerDay[] {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const days: PlannerDay[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      days.push({
        date: date,
        dayName: dayNames[i],
        dayNumber: date.getDate(),
        events: this.getMockEvents(i),
        weather: this.getMockWeather(),
        outfit: i < 5 ? this.getMockOutfit() : undefined
      });
    }

    return days;
  }

  private getMockEvents(dayIndex: number): PlannerEvent[] {
    const weekEvents: PlannerEvent[][] = [
      [{ id: '1', title: 'Team Meeting', time: '10:00 AM', dressCode: 'Business Casual' }],
      [{ id: '2', title: 'Client Presentation', time: '2:00 PM', dressCode: 'Business Formal' }],
      [{ id: '3', title: 'Lunch with Friends', time: '12:30 PM', dressCode: 'Casual' }],
      [{ id: '4', title: 'Gym', time: '6:00 AM', dressCode: 'Athleisure' }, { id: '5', title: 'Dinner Date', time: '7:00 PM', dressCode: 'Smart Casual' }],
      [{ id: '6', title: 'Work from Home', time: 'All Day', dressCode: 'Casual' }],
      [{ id: '7', title: 'Brunch', time: '11:00 AM', dressCode: 'Casual' }],
      []
    ];
    return weekEvents[dayIndex] || [];
  }

  private getMockWeather(): { temperature: number; condition: string; icon: string } {
    return {
      temperature: 28,
      condition: 'Partly Cloudy',
      icon: '⛅'
    };
  }

  private getMockOutfit(): DayOutfit {
    return {
      id: this.generateId(),
      items: [
        { id: '1', name: 'Cotton Blouse', type: 'top', imageUrl: '', color: 'White' },
        { id: '2', name: 'Linen Pants', type: 'bottom', imageUrl: '', color: 'Beige' },
        { id: '3', name: 'Loafers', type: 'shoes', imageUrl: '', color: 'Brown' }
      ]
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
