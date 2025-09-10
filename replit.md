# Chrona - Smart Timetable Management

## Overview

Chrona is a comprehensive SaaS web application designed for generating and managing school timetables using AI-powered optimization. The application provides multi-role access for administrators, teachers, students, and parents, with features including automated timetable generation, teacher substitution management, CSV data import, and export capabilities in multiple formats.

## User Preferences

Preferred communication style: Simple, everyday language.

## Login Credentials

### Current Test Accounts
- **Superadmin Access:** admin@chrona.com / admin123 (full system access, can manage all schools)
- **School Admin Access:** anil@wonder.com / admin123 (manages Wonder School only)

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern component development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **UI Components**: Radix UI primitives with Tailwind CSS for styling using the shadcn/ui design system
- **Styling**: Tailwind CSS with custom CSS variables for consistent theming and dark mode support
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API endpoints
- **Language**: TypeScript for type safety across the entire stack
- **Database ORM**: Drizzle ORM for type-safe database operations and schema management
- **File Processing**: Multer for handling CSV file uploads with memory storage
- **Session Management**: PostgreSQL session storage with connect-pg-simple

### Database Design
- **Primary Database**: PostgreSQL for relational data storage
- **Connection**: Neon serverless PostgreSQL for cloud-native deployment
- **Schema Management**: Drizzle migrations for version-controlled database changes
- **Key Entities**:
  - Users (admin, teacher, student, parent roles)
  - Teachers (with subject assignments and availability)
  - Classes (grade, section, student count)
  - Subjects (with weekly period requirements)
  - Timetable Entries (class-teacher-subject scheduling)
  - Substitutions (absence and replacement management)

### Core Services
- **Timetable Scheduler**: Constraint-based scheduling algorithm for optimal timetable generation
- **CSV Processor**: Automated data import from spreadsheet files with validation
- **Storage Layer**: Abstracted database operations with standardized CRUD interfaces
- **Weekly Timetable Editor**: Direct weekly timetable modifications that bypass approval workflow for admin users

### API Architecture
- RESTful endpoints following standard HTTP conventions
- Centralized error handling middleware
- Request/response logging for debugging and monitoring
- File upload handling with size limits and validation

### Development Environment
- **Hot Reload**: Vite development server with HMR support
- **Development Tools**: TypeScript compiler with strict type checking
- **Path Mapping**: Absolute imports for cleaner code organization
- **Error Handling**: Runtime error overlay for development debugging

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI and Styling
- **Radix UI**: Headless UI components for accessibility and customization
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide React**: Icon library for consistent iconography
- **Font Awesome**: Additional icon support via CDN

### Development and Build
- **Vite**: Frontend build tool with TypeScript support
- **PostCSS**: CSS processing with Autoprefixer
- **ESBuild**: Fast JavaScript/TypeScript bundling for production

### Data Processing
- **Multer**: Multipart form data handling for file uploads
- **Drizzle Kit**: Database migration and schema management tools

### State Management and HTTP
- **TanStack Query**: Server state synchronization and caching
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation for form inputs and API responses

### Planned Integrations
- **Google OR-Tools**: Constraint optimization for advanced timetable generation
- **OpenAI API**: AI-powered timetable optimization suggestions and analysis
- **PDF/Excel Export**: Document generation for timetable distribution