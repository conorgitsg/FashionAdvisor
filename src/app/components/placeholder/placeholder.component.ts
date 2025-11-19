import { Component, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="placeholder-page">
      <div class="placeholder-content">
        <h1>{{ title }}</h1>
        <p>This page is under construction.</p>
        <a routerLink="/" class="btn-back">Back to Home</a>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-xl);
      background-color: var(--color-background);
    }

    .placeholder-content {
      text-align: center;
      max-width: 400px;
    }

    h1 {
      font-size: 2rem;
      color: var(--color-text-primary);
      margin-bottom: var(--spacing-md);
    }

    p {
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-xl);
    }

    .btn-back {
      display: inline-block;
      background-color: var(--color-primary);
      color: var(--color-text-primary);
      padding: var(--spacing-sm) var(--spacing-lg);
      border-radius: 24px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .btn-back:hover {
      background-color: var(--color-primary-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
  `]
})
export class PlaceholderComponent {
  private route = inject(ActivatedRoute);
  title = this.route.snapshot.data['title'] || 'Coming Soon';
}
