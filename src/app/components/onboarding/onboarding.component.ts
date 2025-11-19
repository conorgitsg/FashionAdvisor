import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonaService, PersonaProfile } from '../../services/persona.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css'
})
export class OnboardingComponent {
  currentStep = signal(0);
  totalSteps = 8;
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  savedProfile: PersonaProfile | null = null;

  profile: PersonaProfile = {
    name: '',
    ageRange: '',
    genderPresentation: '',
    height: 170,
    heightUnit: 'cm',
    weight: null,
    shareWeight: false,
    bodyShape: '',
    fitPreference: 50,
    styles: [],
    colors: [],
    patternsToAvoid: [],
    location: '',
    activities: [],
    weatherSensitivity: 'normal',
    goals: []
  };

  // Options
  ageRanges = ['18-24', '25-34', '35-44', '45-54', '55+'];
  genderOptions = [
    { label: 'Masculine', icon: 'M' },
    { label: 'Feminine', icon: 'F' },
    { label: 'Neutral', icon: 'N' }
  ];

  bodyShapes = [
    { id: 'rectangle', label: 'Rectangle', desc: 'Balanced proportions' },
    { id: 'triangle', label: 'Triangle', desc: 'Wider hips' },
    { id: 'hourglass', label: 'Hourglass', desc: 'Balanced curves' },
    { id: 'inverted', label: 'Inverted Triangle', desc: 'Broader shoulders' },
    { id: 'round', label: 'Round', desc: 'Fuller midsection' }
  ];

  styleOptions = [
    { id: 'minimalist', label: 'Minimalist', image: 'https://cdn-icons-png.flaticon.com/512/3523/3523887.png' },
    { id: 'casual', label: 'Casual', image: 'https://cdn-icons-png.flaticon.com/512/2331/2331716.png' },
    { id: 'streetwear', label: 'Streetwear', image: 'https://cdn-icons-png.flaticon.com/512/2503/2503380.png' },
    { id: 'chic', label: 'Chic', image: 'https://cdn-icons-png.flaticon.com/512/3531/3531849.png' },
    { id: 'elegant', label: 'Elegant', image: 'https://cdn-icons-png.flaticon.com/512/3531/3531856.png' },
    { id: 'sporty', label: 'Sporty', image: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png' },
    { id: 'preppy', label: 'Preppy', image: 'https://cdn-icons-png.flaticon.com/512/3531/3531803.png' },
    { id: 'bohemian', label: 'Bohemian', image: 'https://cdn-icons-png.flaticon.com/512/3531/3531963.png' }
  ];

  colorOptions = [
    { id: 'black', hex: '#000000' },
    { id: 'white', hex: '#FFFFFF' },
    { id: 'gray', hex: '#808080' },
    { id: 'navy', hex: '#001F3F' },
    { id: 'brown', hex: '#8B4513' },
    { id: 'beige', hex: '#F5F5DC' },
    { id: 'red', hex: '#DC143C' },
    { id: 'pink', hex: '#FFB6C1' },
    { id: 'orange', hex: '#FF8C00' },
    { id: 'yellow', hex: '#FFD700' },
    { id: 'green', hex: '#228B22' },
    { id: 'blue', hex: '#4169E1' },
    { id: 'purple', hex: '#8B008B' },
    { id: 'teal', hex: '#008080' }
  ];

  patternOptions = ['Stripes', 'Polka Dots', 'Plaid', 'Floral', 'Animal Print', 'Camo'];

  activityOptions = [
    { id: 'work', label: 'Work', icon: 'W' },
    { id: 'casual', label: 'Casual', icon: 'C' },
    { id: 'gym', label: 'Gym', icon: 'G' },
    { id: 'nightlife', label: 'Nightlife', icon: 'N' },
    { id: 'events', label: 'Events', icon: 'E' },
    { id: 'travel', label: 'Travel', icon: 'T' }
  ];

  weatherOptions = [
    { id: 'cold', label: 'I get cold easily' },
    { id: 'hot', label: 'I overheat easily' },
    { id: 'normal', label: 'Normal' }
  ];

  goalOptions = [
    { id: 'save-time', label: 'Save time getting dressed', icon: 'clock' },
    { id: 'maximize', label: 'Maximize my wardrobe', icon: 'grid' },
    { id: 'new-styles', label: 'Try new styles', icon: 'sparkle' },
    { id: 'reduce-fatigue', label: 'Reduce decision fatigue', icon: 'brain' }
  ];

  constructor(public router: Router, private personaService: PersonaService) {
    this.loadSavedProfile();
  }

  getColorHex(colorId: string): string {
    return this.colorOptions.find(c => c.id === colorId)?.hex || '#000000';
  }

  nextStep() {
    if (this.currentStep() < this.totalSteps - 1) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep() {
    if (this.currentStep() > 0) {
      this.currentStep.update(s => s - 1);
    }
  }

  skipToUpload() {
    this.router.navigate(['/upload']);
  }

  completeOnboarding() {
    this.isSaving.set(true);
    this.saveError.set(null);

    this.personaService.savePersona(this.profile).subscribe({
      next: () => {
        localStorage.setItem('userProfile', JSON.stringify(this.profile));
        this.router.navigate(['/inventory']);
      },
      error: (err) => {
        console.error('Failed to save persona', err);
        this.saveError.set('Could not save your profile. Please try again.');
        this.isSaving.set(false);
      }
    });
  }

  useSavedProfile() {
    if (!this.savedProfile) return;
    this.profile = { ...this.savedProfile };
    localStorage.setItem('userProfile', JSON.stringify(this.profile));
    this.router.navigate(['/inventory']);
  }

  private loadSavedProfile() {
    try {
      const saved = localStorage.getItem('userProfile');
      if (saved) {
        this.savedProfile = JSON.parse(saved) as PersonaProfile;
      }
    } catch (err) {
      console.warn('Could not load saved profile', err);
      this.savedProfile = null;
    }
  }

  toggleArrayItem(array: string[], item: string) {
    const index = array.indexOf(item);
    if (index > -1) {
      array.splice(index, 1);
    } else {
      array.push(item);
    }
  }

  isSelected(array: string[], item: string): boolean {
    return array.includes(item);
  }

  canProceed(): boolean {
    switch (this.currentStep()) {
      case 1: // Basic Profile
        return this.profile.name.trim() !== '' &&
               this.profile.ageRange !== '' &&
               this.profile.genderPresentation !== '';
      case 2: // Body & Fit
        return this.profile.bodyShape !== '';
      case 3: // Style
        return this.profile.styles.length > 0;
      case 5: // Lifestyle
        return this.profile.location.trim() !== '' &&
               this.profile.activities.length > 0;
      case 6: // Goals
        return this.profile.goals.length > 0;
      default:
        return true;
    }
  }
}
