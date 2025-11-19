import { Routes } from '@angular/router';

export const routes: Routes = [
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
    path: 'upload',
    loadComponent: () =>
      import('./upload/upload-page.component').then(
        (m) => m.UploadPageComponent
      ),
  }
];
