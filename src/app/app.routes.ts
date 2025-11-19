import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/landing-page/landing-page.component').then(m => m.LandingPageComponent)
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./components/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'inventory',
    loadComponent: () => import('./components/catalog/catalog.component').then(m => m.CatalogComponent)
  },
  {
    path: 'mixer',
    loadComponent: () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Outfit Mixer' }
  },
  {
    path: 'outfits',
    loadComponent: () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Outfit Catalogue' }
  },
  {
    path: 'stylist',
    loadComponent: () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'AI Stylist' }
  },
  {
    path: 'planner',
    loadComponent: () => import('./components/weekly-planner/weekly-planner.component').then(m => m.WeeklyPlannerComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'About' }
  },
  {
    path: 'privacy',
    loadComponent: () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Privacy Policy' }
  },
  {
    path: 'support',
    loadComponent: () => import('./components/placeholder/placeholder.component').then(m => m.PlaceholderComponent),
    data: { title: 'Support' }
  },
  {
    path: 's3-test',
    loadComponent: () => import('./components/s3-test/s3-test.component').then(m => m.S3TestComponent)
  },
  {
    path: 'camera',
    loadComponent: () =>
      import('./camera/camera-capture.component').then(
        (m) => m.CameraCaptureComponent
      ),
  },
  {
    path: 'camera-test',
    loadComponent: () =>
      import('./components/camera-test/camera-test.component').then(
        (m) => m.CameraTestComponent
      ),
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./upload/upload-page.component').then(
        (m) => m.UploadPageComponent
      ),
  },
  {
    path: 'daily-outfit',
    loadComponent: () =>
      import('./components/daily-outfit/daily-outfit.component').then(
        (m) => m.DailyOutfitComponent
      ),
  },
  {
    path: 'daily-outfit/preferences',
    loadComponent: () =>
      import('./components/outfit-preferences/outfit-preferences.component').then(
        (m) => m.OutfitPreferencesComponent
      ),
  }
];
