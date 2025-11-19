import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface UserProfile {
  // Basic Profile
  name: string;
  ageRange: string;
  genderPresentation: string;

  // Body & Fit
  height: number;
  heightUnit: string;
  weight: number | null;
  shareWeight: boolean;
  bodyShape: string;
  fitPreference: number;

  // Style Preferences
  styles: string[];
  colors: string[];
  patternsToAvoid: string[];

  // Lifestyle & Climate
  location: string;
  activities: string[];
  weatherSensitivity: string;

  // Goals
  goals: string[];
}

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

  profile: UserProfile = {
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
    { label: 'Neutral', icon: 'N' },
    { label: 'Custom', icon: '?' }
  ];

  bodyShapes = [
    { id: 'rectangle', label: 'Rectangle', desc: 'Balanced proportions' },
    { id: 'triangle', label: 'Triangle', desc: 'Wider hips' },
    { id: 'hourglass', label: 'Hourglass', desc: 'Balanced curves' },
    { id: 'inverted', label: 'Inverted Triangle', desc: 'Broader shoulders' },
    { id: 'round', label: 'Round', desc: 'Fuller midsection' }
  ];

  styleOptions = [
    { id: 'minimalist', label: 'Minimalist', image: '' },
    { id: 'casual', label: 'Casual', image: '' },
    { id: 'streetwear', label: 'Streetwear', image: '' },
    { id: 'chic', label: 'Chic', image: '' },
    { id: 'elegant', label: 'Elegant', image: '' },
    { id: 'sporty', label: 'Sporty', image: '' },
    { id: 'preppy', label: 'Preppy', image: '' },
    { id: 'bohemian', label: 'Bohemian', image: '' }
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

  constructor(public router: Router) {}

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
    // Save profile to localStorage for now
    localStorage.setItem('userProfile', JSON.stringify(this.profile));
    this.router.navigate(['/inventory']);
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
