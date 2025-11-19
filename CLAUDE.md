# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm start              # Start dev server at http://localhost:4200
npm run build          # Production build (output: dist/)
npm test               # Run unit tests via Karma/Jasmine
npm run watch          # Build with watch mode for development
```

### Angular CLI Commands

```bash
ng generate component components/feature-name   # Create new component
ng generate service services/service-name       # Create new service
```

## Architecture

### Technology Stack
- **Angular 20.3.12** with standalone components (no NgModules)
- **TypeScript 5.8.3** with strict mode enabled
- **Testing**: Jasmine 5.8.0 + Karma 6.4.0

### Key Patterns

**Standalone Components**: All components use standalone API with explicit imports:
```typescript
@Component({
  selector: 'app-feature',
  imports: [RouterOutlet],  // Explicitly declare dependencies
  templateUrl: './feature.html',
  styleUrl: './feature.css'
})
```

**Signal-Based State**: Use Angular Signals for reactive state:
```typescript
protected readonly title = signal('FashionAdvisor');
```

**Zone.js Event Coalescing**: Enabled in `app.config.ts` for better performance.

### Configuration Notes

- **Strict TypeScript**: Full type safety with `strictTemplates`, `strictInjectionParameters`, and `noImplicitReturns`
- **Bundle Budgets**: 500kB warning / 1MB error for initial bundle
- **Component Prefix**: `app`
- **CSS**: Component-scoped styles with CSS variables (OKLCH color space)

### Current State

Routes in `src/app/app.routes.ts` are empty and ready for feature routes. The app template currently displays Angular's default welcome screen.
