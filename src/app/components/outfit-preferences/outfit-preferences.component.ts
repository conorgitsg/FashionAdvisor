import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DailyOutfitService } from '../../services/daily-outfit.service';

@Component({
  selector: 'app-outfit-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './outfit-preferences.component.html',
  styleUrl: './outfit-preferences.component.css'
})
export class OutfitPreferencesComponent {
  protected tags = signal<string[]>([]);
  protected inputValue = signal('');
  protected loading = signal(false);
  protected readonly maxTags = 10;

  protected quickTags = [
    'Casual',
    'Workwear',
    'Summer',
    'Comfy',
    'Dressy',
    'Minimalist'
  ];

  constructor(
    private dailyOutfitService: DailyOutfitService,
    private router: Router
  ) {}

  addTag(tag: string): void {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !this.tags().includes(trimmed) && this.tags().length < this.maxTags) {
      this.tags.update(tags => [...tags, trimmed]);
      this.inputValue.set('');
    }
  }

  addQuickTag(tag: string): void {
    this.addTag(tag);
  }

  removeTag(tag: string): void {
    this.tags.update(tags => tags.filter(t => t !== tag));
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.inputValue()) {
      event.preventDefault();
      this.addTag(this.inputValue());
    }
  }

  findOutfit(): void {
    this.loading.set(true);

    // Store tags in session for the result page
    sessionStorage.setItem('outfitPreferenceTags', JSON.stringify(this.tags()));

    // Navigate to daily outfit with preferences
    this.router.navigate(['/daily-outfit'], {
      queryParams: { fromPreferences: true }
    });
  }

  goBack(): void {
    this.router.navigate(['/daily-outfit']);
  }

  clearAll(): void {
    this.tags.set([]);
  }

  isQuickTagSelected(tag: string): boolean {
    return this.tags().includes(tag.toLowerCase());
  }
}
