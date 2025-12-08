# ArtefatosPro - AI Meeting Documentation System

## Overview

ArtefatosPro is a SaaS platform that transforms meeting transcriptions into structured business documents using artificial intelligence. The system allows users to generate different types of artifacts (business rules, action points, referrals, critical points) from meeting transcripts, with access controlled through subscription plans and user profiles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using functional components and hooks pattern

**UI System**: shadcn/ui component library built on Radix UI primitives
- Design philosophy inspired by modern SaaS platforms (Linear, Stripe, Notion)
- Custom Tailwind configuration with neutral color scheme
- Support for light/dark themes via context provider
- Typography system using Inter and Plus Jakarta Sans fonts

**Routing**: wouter for client-side routing with route-based authentication guards

**State Management**: 
- TanStack Query (React Query) for server state with custom query client
- React Context for theme and authentication state
- No global state management library - relies on server state synchronization

**Key Pages**:
- Public: Landing, Pricing, About, Tools
- Authenticated: Dashboard, Artefatos (artifact generation), Perfil (user profile)
- Admin: Users, Profiles, Plans, Artefatos Gerados (all generated artifacts with filters)

### Backend Architecture

**Server Framework**: Express.js with TypeScript, compiled via esbuild for production

**API Design**: RESTful endpoints organized by resource type
- `/api/auth/*` - Authentication endpoints
- `/api/user/*` - User profile and plan data
- `/api/artifacts/*` - Artifact CRUD operations
- `/api/admin/*` - Administrative operations (implied from frontend routes)

**Authentication**: Replit OpenID Connect (OIDC) integration
- Passport.js strategy for OIDC
- Session-based authentication with PostgreSQL session store
- Role-based access control via profiles/permissions system

**Business Logic**:
- AI artifact generation using OpenAI GPT models
- Type-safe schema validation using Zod
- Permission checking based on user profiles and subscription plans

### Data Storage

**Database**: PostgreSQL via Drizzle ORM

**Schema Design**:
- `sessions` - Session storage for authentication
- `users` - User accounts (managed via OIDC)
- `profiles` - Role definitions with permissions array
- `plans` - Subscription tiers with feature flags and tool access
- `artifacts` - Generated documents linked to users
- `templates` - Reusable templates for artifact generation (text or file-based)
- `artifact_types` - Dynamic artifact type definitions with title, description, and slug

**ORM Pattern**: Drizzle with type-safe queries and Zod schema integration
- Shared schema definitions between client and server
- Database migrations managed via drizzle-kit
- Connection pooling with pg library

**Key Relationships**:
- Users → Profile (one-to-one)
- Users → Plan (one-to-one)
- Users → Artifacts (one-to-many)

### AI Integration

**Provider**: OpenAI API (GPT-4o model)

**Artifact Types**: Dynamically managed via database (artifact_types table)
- Default seeded types: Business Rules, Action Points, Referrals, Critical Points
- Admin can create, edit, and delete artifact types via `/admin/tipos-artefatos`
- Each type has slug, title, description, and active status
- Legacy prompts maintained for backward compatibility with default types
- Dynamic prompt generation for custom types based on title/description

**Processing Pattern**:
- User submits transcript via form
- Server validates plan permissions and usage limits
- Server fetches artifact type metadata from database
- AI generates structured Markdown document using type-specific or dynamic prompts
- Templates can be optionally applied to guide artifact format
- Result stored in database and returned to client
- PDF export capability using PDFKit

### Build System

**Development**:
- Vite for frontend dev server with HMR
- tsx for running TypeScript server code
- Replit-specific plugins for development banner and error overlay

**Production**:
- Custom build script using esbuild for server bundling
- Vite for client-side production build
- Selected dependencies bundled to reduce cold start time
- Single CJS output for deployment

**Asset Handling**:
- Static files served from dist/public
- Vite handles client-side code splitting and optimization
- Fallback to index.html for SPA routing

## External Dependencies

**AI Services**:
- OpenAI API - GPT models for content generation (configured to use latest available model)

**Authentication**:
- Replit OIDC - Identity provider for user authentication
- OpenID Connect client library for OIDC flow

**Database**:
- PostgreSQL - Primary data store (connection via DATABASE_URL environment variable)
- Drizzle ORM - Type-safe database access layer

**UI Framework**:
- Radix UI - Headless component primitives
- Tailwind CSS - Utility-first styling
- Lucide React - Icon system

**Session Management**:
- connect-pg-simple - PostgreSQL session store for Express
- express-session - Session middleware

**Key NPM Packages**:
- react-hook-form with Zod resolvers for form validation
- date-fns for date manipulation
- wouter for lightweight routing
- nanoid for ID generation
- PDFKit for PDF document generation

**Development Tools**:
- TypeScript for type safety
- ESBuild for fast bundling
- Vite for development experience
- Replit-specific tooling for deployment environment