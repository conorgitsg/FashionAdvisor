import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DailyOutfitService, DailyOutfitResponse, OutfitRecommendation } from '../../services/daily-outfit.service';

@Component({
  selector: 'app-daily-outfit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-outfit.component.html',
  styleUrl: './daily-outfit.component.css'
})
export class DailyOutfitComponent implements OnInit {
  protected data = signal<DailyOutfitResponse | null>(null);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected expandedAlternative = signal<string | null>(null);
  protected wearingOutfit = signal(false);
  protected appliedTags = signal<string[]>([]);

  constructor(
    private dailyOutfitService: DailyOutfitService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check if coming from preferences page
    this.route.queryParams.subscribe(params => {
      if (params['fromPreferences']) {
        const storedTags = sessionStorage.getItem('outfitPreferenceTags');
        if (storedTags) {
          const tags = JSON.parse(storedTags);
          this.appliedTags.set(tags);
          this.loadOutfitWithPreferences(tags);
          sessionStorage.removeItem('outfitPreferenceTags');
          return;
        }
      }
      this.loadDailyOutfit();
    });
  }

  loadDailyOutfit(): void {
    this.loading.set(true);
    this.error.set(null);
    this.appliedTags.set([]);

    this.dailyOutfitService.getDailyOutfit().subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load outfit recommendation');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  loadOutfitWithPreferences(tags: string[]): void {
    this.loading.set(true);
    this.error.set(null);

    this.dailyOutfitService.getOutfitByPreferences(tags).subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load personalized outfit');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  getWeatherIcon(icon: string): string {
    const icons: Record<string, string> = {
      'sunny': '☀️',
      'partly-cloudy': '⛅',
      'cloudy': '☁️',
      'rainy': '🌧️',
      'stormy': '⛈️',
      'snowy': '❄️',
      'windy': '💨'
    };
    return icons[icon] || '🌤️';
  }

  openPreferences(): void {
    this.router.navigate(['/daily-outfit/preferences']);
  }

  wearOutfit(outfit: OutfitRecommendation): void {
    this.wearingOutfit.set(true);

    this.dailyOutfitService.markAsWorn(outfit.id).subscribe({
      next: () => {
        this.wearingOutfit.set(false);
        // Show success feedback
        alert('Outfit logged as worn today!');
      },
      error: (err) => {
        this.wearingOutfit.set(false);
        console.error(err);
        alert('Failed to log outfit');
      }
    });
  }

  toggleAlternative(outfitId: string): void {
    if (this.expandedAlternative() === outfitId) {
      this.expandedAlternative.set(null);
    } else {
      this.expandedAlternative.set(outfitId);
    }
  }

  useAlternative(outfit: OutfitRecommendation): void {
    const currentData = this.data();
    if (currentData) {
      // Swap main outfit with selected alternative
      const oldMain = currentData.mainOutfit;
      const newAlternatives = currentData.alternatives.filter(a => a.id !== outfit.id);
      newAlternatives.push({ ...oldMain, isAlternative: true });

      this.data.set({
        ...currentData,
        mainOutfit: { ...outfit, isAlternative: false },
        alternatives: newAlternatives
      });

      this.expandedAlternative.set(null);
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
