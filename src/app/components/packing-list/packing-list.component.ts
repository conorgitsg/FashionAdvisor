import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WeeklyPlannerService, PlannerWeek, PlannerDay } from '../../services/weekly-planner.service';

interface PackingItem {
  id: string;
  name: string;
  type: string;
  forEvent: string;
  dressCode: string;
  packed: boolean;
}

interface DayPacking {
  date: Date;
  dayName: string;
  items: PackingItem[];
  needsPacking: boolean;
}

@Component({
  selector: 'app-packing-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './packing-list.component.html',
  styleUrl: './packing-list.component.css'
})
export class PackingListComponent implements OnInit {
  packingDays = signal<DayPacking[]>([]);
  loading = signal(true);

  constructor(
    private plannerService: WeeklyPlannerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPackingList();
  }

  loadPackingList(): void {
    this.plannerService.getCurrentWeek().subscribe(week => {
      const packingDays = this.generatePackingList(week);
      this.packingDays.set(packingDays);
      this.loading.set(false);
    });
  }

  private generatePackingList(week: PlannerWeek): DayPacking[] {
    return week.days
      .map(day => {
        const uniqueDressCodes = this.getUniqueDressCodes(day);
        const needsPacking = uniqueDressCodes.length >= 2;

        const items: PackingItem[] = [];

        if (needsPacking && day.outfit) {
          // Group items by event/dress code
          day.events.forEach(event => {
            if (event.dressCode) {
              day.outfit?.items.forEach(item => {
                items.push({
                  id: `${event.id}-${item.id}`,
                  name: item.name,
                  type: item.type,
                  forEvent: event.title,
                  dressCode: event.dressCode || 'Casual',
                  packed: false
                });
              });
            }
          });
        }

        return {
          date: day.date,
          dayName: day.dayName,
          items,
          needsPacking
        };
      })
      .filter(day => day.needsPacking && day.items.length > 0);
  }

  private getUniqueDressCodes(day: PlannerDay): string[] {
    const dressCodes = day.events
      .map(e => e.dressCode)
      .filter((code): code is string => !!code);
    return [...new Set(dressCodes)];
  }

  togglePacked(item: PackingItem): void {
    item.packed = !item.packed;
  }

  getPackedCount(items: PackingItem[]): number {
    return items.filter(i => i.packed).length;
  }

  getTotalCount(): number {
    return this.packingDays().reduce((sum, day) => sum + day.items.length, 0);
  }

  getTotalPackedCount(): number {
    return this.packingDays().reduce((sum, day) => sum + this.getPackedCount(day.items), 0);
  }

  goBack(): void {
    this.router.navigate(['/planner']);
  }

  getItemIcon(type: string): string {
    const icons: Record<string, string> = {
      'top': '👕',
      'bottom': '👖',
      'dress': '👗',
      'outerwear': '🧥',
      'shoes': '👟',
      'accessory': '👜'
    };
    return icons[type] || '👔';
  }
}
