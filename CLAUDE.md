# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Frontend (Angular)
```bash
npm start              # Start dev server at http://localhost:4200
npm run build          # Production build (output: dist/)
npm test               # Run unit tests via Karma/Jasmine
npm run watch          # Build with watch mode for development
```

### Backend (Express Server)
```bash
cd server
npm install            # Install server dependencies
node index.js          # Start server at http://localhost:3000
```

### Angular CLI Commands

```bash
ng generate component components/feature-name   # Create new component
ng generate service services/service-name       # Create new service
```

## Environment Variables

The backend server requires these environment variables (use `.env` file in `server/`):
```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-southeast-1           # Optional, defaults to ap-southeast-1
S3_BUCKET_NAME=fashion-advisor      # Optional, defaults to fashion-advisor

# PostgreSQL Database (AWS RDS)
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432                        # Optional, defaults to 5432
DB_NAME=postgres                    # Default RDS database
DB_USER=your-username
DB_PASSWORD=your-password
DB_SSL=true                         # Set to true for AWS RDS

# Server
PORT=3000                           # Optional, defaults to 3000
```

## Architecture

### Technology Stack

**Frontend:**
- **Angular 20.1.0** with standalone components (no NgModules)
- **TypeScript 5.8.2** with strict mode enabled
- **RxJS 7.8.0**
- **Testing**: Jasmine 5.8.0 + Karma 6.4.0

**Backend:**
- **Express 4.18.0** server
- **AWS SDK v3** (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner)
- **pg (node-postgres)** for PostgreSQL database
- **Multer 1.4.5** for file uploads

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
- **Bundle Budgets**: 500kB warning / 1MB error for initial bundle; 12kB warning / 16kB error for component styles
- **Component Prefix**: `app`
- **CSS**: Global design system in `src/styles.css` with CSS variables

### Design System

**Color Palette** (defined in `src/styles.css`):
- Primary: `#D5ADB8` (Mauve Pink)
- Background: `#FAF9F6` (Soft Beige)
- Text Primary: `#2B2B2B` (Charcoal)
- Text Secondary: `#6E6E6E` (Muted Gray)
- Border: `#E5E5E5` (Light Gray)
- Accent: `#EFEAFC` (Soft Lilac)

**Typography**: Inter font family, bold headers, medium labels

**Components Available**:
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-lg`, `.btn-sm`
- `.card`, `.card-hover`
- `.tag`, `.tag-remove`
- `.upload-area`, `.upload-icon`
- `.form-group`, form elements
- `.container`, `.container-sm`, `.container-md`

**Spacing Variables**: `--spacing-xs` (4px) through `--spacing-2xl` (48px)

**Border Radius**: `--radius-sm` (8px) through `--radius-full` (9999px)

### Project Structure

```
src/app/
  components/
    landing-page/         # Main landing page with hero, features, footer
    onboarding/           # Multi-step onboarding wizard (8 screens)
    placeholder/          # Reusable placeholder for unbuilt pages
    s3-test/              # S3 upload testing component
    camera-test/          # Camera functionality test page
    daily-outfit/         # Daily smart outfit recommendation page
    outfit-preferences/   # Tag-based outfit preference input
    catalog/              # Wardrobe catalog with filtering
    weekly-planner/       # Weekly planner with events and outfit scheduling
    login/                # Email login page
  camera/                 # Camera capture component
  upload/                 # Upload page with camera/file modes
  services/
    s3-image.service.ts   # S3 API client service
    ai-tagging.service.ts # AI tagging service
    daily-outfit.service.ts # Daily outfit recommendation API service
    catalog.service.ts    # Catalog data and filtering service
    weekly-planner.service.ts # Weekly planner event and outfit management
  app.ts                  # Root component
  app.routes.ts           # Route configuration
  app.config.ts           # App providers config
server/
  index.js                # Express backend for S3 and database
  database.js             # PostgreSQL connection pool and helpers
```

### S3 Integration

**S3ImageService** (`src/app/services/s3-image.service.ts`):
- `uploadImage(file)` - Upload via backend
- `listImages(limit, token)` - Paginated listing
- `deleteImage(key)` - Remove from S3
- `getSignedViewUrl(key)` - Temporary view URL

**Backend API Endpoints** (port 3000):
- `GET /api/health` - Health check
- `POST /api/images/upload` - Upload image (10MB limit, images only)
- `GET /api/images` - List images with pagination
- `GET /api/images/:key` - Get image metadata
- `DELETE /api/images/:key` - Delete image
- `GET /api/db/health` - Database health check

### Database Service

**database.js** (`server/database.js`):
- `query(text, params)` - Execute parameterized query
- `getClient()` - Get client for transactions
- `healthCheck()` - Check database connectivity
- `close()` - Close connection pool

**Usage example:**
```javascript
const db = require('./database');
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

### Routes

```typescript
// src/app/app.routes.ts - Main application routes
{ path: '', loadComponent: () => import('./components/landing-page/landing-page.component') }
{ path: 'onboarding', loadComponent: () => import('./components/onboarding/onboarding.component') }
{ path: 'login', loadComponent: () => import('./components/login/login.component') }
{ path: 'inventory', loadComponent: () => import('./components/catalog/catalog.component') }
{ path: 'outfits', loadComponent: () => import('./components/placeholder/placeholder.component') }
{ path: 'stylist', loadComponent: () => import('./components/placeholder/placeholder.component') }
{ path: 'planner', loadComponent: () => import('./components/weekly-planner/weekly-planner.component') }
{ path: 's3-test', loadComponent: () => import('./components/s3-test/s3-test.component') }
{ path: 'camera', loadComponent: () => import('./camera/camera-capture.component') }
{ path: 'camera-test', loadComponent: () => import('./components/camera-test/camera-test.component') }
{ path: 'upload', loadComponent: () => import('./upload/upload-page.component') }
{ path: 'daily-outfit', loadComponent: () => import('./components/daily-outfit/daily-outfit.component') }
{ path: 'daily-outfit/preferences', loadComponent: () => import('./components/outfit-preferences/outfit-preferences.component') }
```

### AWS RDS Setup Requirements

For the PostgreSQL database connection to work:
1. **Public accessibility** = Yes (RDS → Modify → Connectivity)
2. **Security group** inbound rule for port 5432 from your IP
3. **Route table** for RDS subnets must have route to internet gateway (0.0.0.0/0 → igw-xxx)
4. All subnets in the DB subnet group need the internet gateway route

### Current State

The app has S3 connectivity implemented with a test component at `/s3-test`. PostgreSQL database is connected and working. The landing page displays a full marketing page with hero section, "How It Works" steps, feature previews, and footer.

**Available routes:**
- `/` - Full landing page with hero, features, footer
- `/onboarding` - 8-step onboarding wizard with profile creation
- `/login` - Email login page
- `/inventory` - Wardrobe catalog with filtering and sorting
- `/outfits` - Outfit Catalogue (placeholder)
- `/stylist` - AI Stylist (placeholder)
- `/planner` - Weekly planner with event and outfit scheduling
- `/about`, `/privacy`, `/support` - Footer links (placeholders)
- `/s3-test` - S3 upload testing
- `/camera` - Camera capture component (standalone)
- `/camera-test` - Camera capture with S3 upload and gallery
- `/upload` - Upload page with camera/file modes and AI tagging pipeline
- `/daily-outfit` - Daily smart outfit recommendation with weather integration
- `/daily-outfit/preferences` - Tag-based preference input for personalized outfits

### Landing Page Structure

The landing page (`/`) includes:
1. **Hero Section** - Split layout with CTA "Start Your Style Profile" linking to `/onboarding`
2. **How It Works** - 3-column grid (Capture, Auto-Calibration, Style DNA)
3. **Feature Highlights** - Digital Wardrobe (catalog), Outfit Mixer, Weather-Aware Planning, and Daily Smart Outfit previews
4. **Footer** - Navigation links and social icons (Instagram, TikTok)

### Placeholder Component

Reusable placeholder component for unbuilt pages. Uses route data for dynamic titles:
```typescript
// Usage in routes
{ path: 'example', loadComponent: () => import('./components/placeholder/placeholder.component'), data: { title: 'Page Title' } }
```

### Onboarding Flow

The onboarding component (`/onboarding`) is an 8-step wizard that collects user profile data:

1. **Welcome** - App intro with "Get Started" CTA
2. **Basic Profile** - Name, age range, gender presentation (chips)
3. **Body & Fit** - Height, weight (optional), body shape (visual cards), fit slider
4. **Style Preferences** - Style tiles, color bubbles, patterns to avoid
5. **Wardrobe Upload Intro** - Photo guidelines with option to skip
6. **Lifestyle & Climate** - Location, activities (chips), weather sensitivity
7. **Goals** - Multi-select goal cards (save time, maximize wardrobe, etc.)
8. **Final** - Profile summary with completion CTA

**User Profile Data Structure:**
```typescript
interface UserProfile {
  name: string;
  ageRange: string;
  genderPresentation: string;
  height: number;
  heightUnit: string;
  weight: number | null;
  bodyShape: string;
  fitPreference: number; // 0-100 (tight to oversized)
  styles: string[];
  colors: string[];
  patternsToAvoid: string[];
  location: string;
  activities: string[];
  weatherSensitivity: string;
  goals: string[];
}
```

Profile is saved to localStorage on completion and user is redirected to `/inventory`.

### Camera Test Feature

The camera test page (`/camera-test`) provides full camera-to-S3 integration for capturing and storing wardrobe photos.

**Features:**
- Camera capture using device camera (prefers back camera)
- Automatic upload to S3 on photo capture
- Gallery displaying all images from S3
- Individual and bulk delete functionality
- Upload progress indicator with spinner
- Error handling for failed uploads
- Refresh button to reload images from S3
- Stats showing total photos and last upload time

**Component Methods:**
- `loadImages()` - Fetch all images from S3
- `onPhotoCaptured(blob)` - Upload captured photo to S3
- `deleteImage(image)` - Delete single image from S3
- `clearAllImages()` - Delete all images from S3
- `refreshImages()` - Reload gallery from S3

**Integration:**
- Uses `S3ImageService` for all S3 operations
- Images displayed using S3 URLs from backend
- Filenames generated as `camera-{timestamp}.jpg`

### Login Feature

The login page (`/login`) provides email-based authentication.

**Features:**
- Email and password input fields
- Loading state during authentication
- Error message display
- Forgot password functionality
- Link to create account (onboarding)

**Component Methods:**
- `onSubmit()` - Validates and processes login
- `forgotPassword()` - Handles password reset request

**Authentication Flow:**
- Validates email format
- Stores login state in localStorage
- Redirects to `/inventory` on success

### Daily Outfit Feature

The daily outfit feature provides AI-powered outfit recommendations based on weather and user preferences.

**Daily Outfit Page** (`/daily-outfit`):
- Weather display (temperature, feels like, condition icon)
- Main outfit recommendation with clothing items (top, bottom, shoes, accessory)
- "Wear This" button to log outfit as worn
- "Why this outfit?" explanation section
- 3 alternative outfit cards (expandable with "Wear This Instead" option)
- Preferences button to navigate to tag input

**Preferences Page** (`/daily-outfit/preferences`):
- Text input for adding custom tags (max 10)
- 6 quick-add preset tags: Casual, Workwear, Summer, Comfy, Dressy, Minimalist
- Tag removal with × button
- Example tags section (style, occasion, weather, items)
- "Find Outfit" submits tags and returns personalized recommendation

**DailyOutfitService** (`src/app/services/daily-outfit.service.ts`):
- `getDailyOutfit()` - Get default daily recommendation
- `getOutfitByPreferences(tags)` - Get outfit based on user tags
- `markAsWorn(outfitId)` - Log outfit as worn today

**Data Structures:**
```typescript
interface WeatherInfo {
  temperature: number;
  feelsLike: number;
  condition: string;
  icon: string;
  rainChance?: number;
}

interface OutfitItem {
  id: string;
  name: string;
  type: 'top' | 'bottom' | 'shoes' | 'accessory';
  imageUrl: string;
  color?: string;
}

interface OutfitRecommendation {
  id: string;
  items: OutfitItem[];
  reason: string;
  isAlternative?: boolean;
}
```

### Catalog Feature

The catalog feature allows users to browse and filter their wardrobe items and outfit combinations.

**Catalog Overview** (`/inventory`):
- View mode tabs: Clothing / Outfits / All
- Quick filter chips: All, Tops, Bottoms, Dresses, Outerwear
- Sort options: Most Recent, Most Worn, Least Worn, Alphabetical
- Grid display of clothing items and outfits
- Active filter tags with removal
- "Filters" button opens bottom sheet

**Filter Bottom Sheet**:
- Item Type: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories
- Colors: White, Black, Blue, Beige, Pastel, Multi-color
- Style/Occasion: Casual, Workwear, Party, Minimalist, Feminine, Travel, Athleisure
- Season/Weather: Summer, Monsoon, Winter, All-season
- Usage: Most Worn, Under-used, Never Worn
- Outfit Filters: 2-piece, 3-piece, 4-piece
- Reset and Show Results actions

**CatalogService** (`src/app/services/catalog.service.ts`):
- `getClothingItems(filters, sort)` - Get filtered/sorted clothing
- `getOutfits(filters, sort)` - Get filtered/sorted outfits

**Data Structures:**
```typescript
interface ClothingItem {
  id: string;
  name: string;
  type: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
  category: string;
  tags: string[];
  colors: string[];
  imageUrl: string;
  usageFrequency: number;
  dateAdded: Date;
  season?: string[];
  style?: string[];
}

interface Outfit {
  id: string;
  name: string;
  items: ClothingItem[];
  tags: string[];
  category?: string;
  imageUrl: string;
  lastModified: Date;
  pieceCount: number;
}

interface CatalogFilters {
  itemType: string[];
  colors: string[];
  styles: string[];
  seasons: string[];
  usage: string[];
  outfitTypes: string[];
}
```

### Weekly Planner Feature

The weekly planner allows users to schedule events and plan outfits for the week ahead.

**Weekly Planner Page** (`/planner`):
- Weekly grid view with 7 day cards (lilac background)
- Week navigation (previous/next week)
- Each day card displays:
  - Day name and date
  - Weather info (temperature, icon)
  - Events with time, title, dress code
  - Suggested outfit with item chips
- Add/edit/delete events
- AI outfit suggestion per day
- "View Packing List" button
- Today highlighting with primary border

**Event Modal**:
- Event title (required)
- Time
- Location
- Dress code selector (Casual, Business Casual, Business Formal, Smart Casual, Athleisure, Dressy)

**Outfit Modal**:
- Outfit item breakdown with type icons
- Regenerate outfit option

**WeeklyPlannerService** (`src/app/services/weekly-planner.service.ts`):
- `getCurrentWeek()` - Get current week's planner data
- `getWeekByDate(date)` - Get week by specific date
- `addEvent(dayDate, event)` - Add event to a day
- `updateEvent(eventId, updates)` - Update existing event
- `deleteEvent(eventId)` - Remove event
- `setDayOutfit(dayDate, outfit)` - Set outfit for a day
- `suggestOutfit(dayDate, events)` - Get AI outfit suggestion based on day's events

**Data Structures:**
```typescript
interface PlannerEvent {
  id: string;
  title: string;
  time?: string;
  location?: string;
  dressCode?: string;
  notes?: string;
}

interface OutfitItem {
  id: string;
  name: string;
  type: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
  imageUrl: string;
  color?: string;
}

interface DayOutfit {
  id: string;
  items: OutfitItem[];
  occasion?: string;
}

interface PlannerDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  events: PlannerEvent[];
  outfit?: DayOutfit;
  weather?: {
    temperature: number;
    condition: string;
    icon: string;
  };
}

interface PlannerWeek {
  id: string;
  startDate: Date;
  endDate: Date;
  days: PlannerDay[];
}
```
