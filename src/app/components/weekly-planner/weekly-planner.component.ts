import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WeeklyPlannerService, PlannerWeek, PlannerDay, PlannerEvent, DayOutfit } from '../../services/weekly-planner.service';

@Component({
  selector: 'app-weekly-planner',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './weekly-planner.component.html',
  styleUrl: './weekly-planner.component.css'
})
export class WeeklyPlannerComponent implements OnInit {
  week = signal<PlannerWeek | null>(null);
  selectedDay = signal<PlannerDay | null>(null);
  showEventModal = signal(false);
  showOutfitModal = signal(false);
  editingEvent = signal<PlannerEvent | null>(null);
  planningWeek = signal(false);
  planError = signal<string | null>(null);

  newEvent: Partial<PlannerEvent> = {
    title: '',
    time: '',
    location: '',
    dressCode: ''
  };

  dressCodeOptions = ['Casual', 'Business Casual', 'Business Formal', 'Smart Casual', 'Athleisure', 'Dressy'];

  constructor(
    private plannerService: WeeklyPlannerService,
    private router: Router
  ) {}

  goBack(): void {
    this.router.navigate(['/']);
  }

  ngOnInit(): void {
    this.loadCurrentWeek();
  }

  loadCurrentWeek(): void {
    this.plannerService.getCurrentWeek().subscribe(week => {
      this.week.set(week);
    });
  }

  navigateWeek(direction: number): void {
    const currentWeek = this.week();
    if (!currentWeek) return;

    const newDate = new Date(currentWeek.startDate);
    newDate.setDate(newDate.getDate() + (direction * 7));

    this.plannerService.getWeekByDate(newDate).subscribe(week => {
      this.week.set(week);
    });
  }

  selectDay(day: PlannerDay): void {
    this.selectedDay.set(day);
  }

  openAddEventModal(day: PlannerDay): void {
    this.selectedDay.set(day);
    this.editingEvent.set(null);
    this.newEvent = { title: '', time: '', location: '', dressCode: '' };
    this.showEventModal.set(true);
  }

  openEditEventModal(day: PlannerDay, event: PlannerEvent): void {
    this.selectedDay.set(day);
    this.editingEvent.set(event);
    this.newEvent = { ...event };
    this.showEventModal.set(true);
  }

  closeEventModal(): void {
    this.showEventModal.set(false);
    this.editingEvent.set(null);
  }

  saveEvent(): void {
    const day = this.selectedDay();
    if (!day || !this.newEvent.title) return;

    if (this.editingEvent()) {
      // Update existing event
      const eventId = this.editingEvent()!.id;
      this.plannerService.updateEvent(eventId, this.newEvent).subscribe(() => {
        this.updateDayEvent(day, eventId, this.newEvent);
        this.closeEventModal();
      });
    } else {
      // Add new event
      this.plannerService.addEvent(day.date, this.newEvent as Omit<PlannerEvent, 'id'>).subscribe(event => {
        day.events.push(event);
        this.closeEventModal();
      });
    }
  }

  deleteEvent(day: PlannerDay, event: PlannerEvent): void {
    this.plannerService.deleteEvent(event.id).subscribe(() => {
      day.events = day.events.filter(e => e.id !== event.id);
    });
  }

  private updateDayEvent(day: PlannerDay, eventId: string, updates: Partial<PlannerEvent>): void {
    const eventIndex = day.events.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
      day.events[eventIndex] = { ...day.events[eventIndex], ...updates };
    }
  }

  openOutfitModal(day: PlannerDay): void {
    this.selectedDay.set(day);
    this.showOutfitModal.set(true);
  }

  closeOutfitModal(): void {
    this.showOutfitModal.set(false);
  }

  suggestOutfit(day: PlannerDay): void {
    this.plannerService.suggestOutfit(day.date, day.events).subscribe(outfit => {
      day.outfit = outfit;
    });
  }

  planWeekOutfits(): void {
    const currentWeek = this.week();
    if (!currentWeek) return;
    this.planningWeek.set(true);
    this.planError.set(null);

    this.plannerService.planOutfitsForWeek(currentWeek.days).subscribe({
      next: (plannedDays) => {
        for (const entry of plannedDays) {
          const targetDay = currentWeek.days.find(
            (d) => d.date.toISOString().split('T')[0] === entry.date && entry.outfit
          );
          if (targetDay && entry.outfit) {
            targetDay.outfit = entry.outfit;
          }
        }
        this.planningWeek.set(false);
      },
      error: (err) => {
        console.error('Failed to plan week outfits', err);
        this.planError.set('Unable to plan outfits right now. Please try again soon.');
        this.planningWeek.set(false);
      }
    });
  }

  clearOutfit(day: PlannerDay): void {
    day.outfit = undefined;
  }

  getWeekRange(): string {
    const currentWeek = this.week();
    if (!currentWeek) return '';

    const startMonth = currentWeek.startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = currentWeek.endDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = currentWeek.startDate.getDate();
    const endDay = currentWeek.endDate.getDate();
    const year = currentWeek.endDate.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  getOutfitPreview(outfit: DayOutfit): string {
    return outfit.items.map(item => item.name).join(', ');
  }
}
