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
- **Bundle Budgets**: 500kB warning / 1MB error for initial bundle
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
    s3-test/              # S3 upload testing component
  services/
    s3-image.service.ts   # S3 API client service
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
// src/app/app.routes.ts
{ path: 's3-test', loadComponent: () => import('./components/s3-test/s3-test.component') }
```

### AWS RDS Setup Requirements

For the PostgreSQL database connection to work:
1. **Public accessibility** = Yes (RDS → Modify → Connectivity)
2. **Security group** inbound rule for port 5432 from your IP
3. **Route table** for RDS subnets must have route to internet gateway (0.0.0.0/0 → igw-xxx)
4. All subnets in the DB subnet group need the internet gateway route

### Current State

The app has S3 connectivity implemented with a test component at `/s3-test`. PostgreSQL database service is configured but requires AWS RDS network setup. The root template displays a styled hero landing page with the FashionAdvisor design system applied.
