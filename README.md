# Vendor Portal CPD Request System

A vendor-facing portal for submitting CPD requests, viewing request status, and uploading attendance files.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Shadcn/ui + Tailwind CSS
- **Forms**: TanStack Form + Zod validation
- **Data Fetching**: TanStack Query
- **Tables**: TanStack Table
- **Backend**: Supabase (PostgreSQL + Edge Functions + Storage)
- **Routing**: React Router
- **Package Manager**: Bun

## Project Structure

```
src/
  components/
    vendor/          # Vendor-specific components
    ui/              # Shadcn/ui components
  pages/
    vendor/          # Vendor portal pages
  lib/               # Utilities, API clients, types
  hooks/             # Custom React hooks
supabase/
  functions/         # Edge Functions
  migrations/        # Database migrations
```

## Setup Instructions

### 1. Install Dependencies

```bash
bun install
```

### 2. Set Up Supabase (self-hosted)

Production uses **self-hosted Supabase** on HKRA infrastructure (not Supabase Cloud).

1. Obtain the instance URL and anon key from your administrator.
2. Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-hkra-supabase-instance
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Run Database Migrations

**Production / staging:** open **SQL Editor** in Supabase Studio (or `psql`), then **paste and execute** each file in [`supabase/migrations/`](supabase/migrations/) in **filename order**. Skip files already applied.

Do **not** use `supabase db push` unless your team has explicitly configured the CLI against this host.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for a full checklist, including recent Zoom migrations.

### 4. Set Up Storage Buckets

The migrations will create the storage buckets, but you may need to verify they exist in your Supabase dashboard:

- `vendor-posters` - For event poster images
- `vendor-attendance` - For attendance CSV/XLSX files

### 5. Create Vendor User Accounts

Vendor accounts need to be created with:

1. A user in Supabase Auth with `role: 'vendor'` in user metadata
2. A corresponding record in the `vendors` table

**See [docs/SETUP_VENDOR_USERS.md](docs/SETUP_VENDOR_USERS.md) for detailed instructions.**

Quick methods:

**Method 1: Using Supabase Dashboard + SQL Editor**

1. Go to Authentication > Users > Add User
2. Create user with email/password
3. **Note:** Dashboard UI doesn't allow editing user metadata directly
4. Go to SQL Editor and run:

   ```sql
   -- Set role
   UPDATE auth.users
   SET raw_user_meta_data = jsonb_set(
     COALESCE(raw_user_meta_data, '{}'::jsonb),
     '{role}',
     '"vendor"'
   )
   WHERE email = 'vendor@example.com';

   -- Create vendor record
   INSERT INTO vendors (user_id, company_name, contact_name, contact_email, contact_phone)
   SELECT id, 'Company Name', 'Contact Name', email, '+1234567890'
   FROM auth.users WHERE email = 'vendor@example.com';
   ```

**Method 2: Using Helper Script**

```bash
# Set environment variables
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run script
bun run scripts/setup-vendor-user.ts vendor@example.com password123 "Company Name" "Contact Name"
```

**Method 3: Using SQL Function**
After creating auth user, run:

```sql
SELECT setup_vendor_user(
  (SELECT id FROM auth.users WHERE email = 'vendor@example.com'),
  'Company Name',
  'Contact Name',
  'vendor@example.com',
  '+1234567890'
);
```

### 6. Deploy Edge Functions

**For Self-Hosted Supabase:** See [docs/DEPLOY_EDGE_FUNCTIONS.md](docs/DEPLOY_EDGE_FUNCTIONS.md) for detailed instructions.

**Quick Deploy (Self-Hosted - No Project-Ref):**

```bash
# Method 1: Docker Copy (Recommended)
# Linux/Mac:
export DOCKER_CONTAINER=supabase_functions
./scripts/deploy-functions.sh

# Windows PowerShell:
.\scripts\deploy-functions.ps1 -DockerContainer supabase_functions

# Method 2: Docker Compose with Volume Mount
./scripts/deploy-functions-docker.sh

# Method 3: Manual Docker Copy
docker cp supabase/functions/vendor-requests supabase_functions:/home/deno/functions/
docker cp supabase/functions/vendor-upload supabase_functions:/home/deno/functions/
docker restart supabase_functions
```

**Deploy from another machine to the VPS:**

```powershell
$env:SSH_TARGET = "user@your.vps"
.\scripts\deploy-functions-vps.ps1
```

### 7. Deploy to Cloudflare

**See [docs/DEPLOY_CLOUDFLARE.md](docs/DEPLOY_CLOUDFLARE.md) for detailed deployment instructions.**

Quick deploy:

```bash
# Install Wrangler CLI (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build and deploy
npm run deploy:pages
```

### 8. Run Development Server

```bash
bun dev
```

The app will be available at `http://localhost:5173`

## Features

### Vendor Portal Routes

- `/vendor/login` - Vendor authentication
- `/vendor/dashboard` - List all vendor requests
- `/vendor/request/new` - Create new CPD request
- `/vendor/request/:id` - View request details
- `/vendor/request/:id/edit` - Edit pending request

### Key Features

- **Request Management**: Create, view, edit, and withdraw CPD requests
- **Status Tracking**: Real-time status updates (pending, approved, rejected, withdrawn)
- **File Uploads**: Upload event posters and attendance files
- **Filtering & Sorting**: Filter by status and sort by various columns
- **Form Validation**: Comprehensive validation using Zod schemas
- **Responsive Design**: Mobile-friendly interface

## Database Schema

### Tables

- `vendors` - Vendor company information
- `vendor_requests` - CPD request submissions
- `vendor_request_status_history` - Audit trail for status changes

### Row Level Security (RLS)

- Vendors can only access their own requests
- Admins have full access (via role check)
- Storage policies enforce vendor-specific folder access

## API Endpoints

### Edge Functions

- `vendor-requests` - CRUD operations for requests

  - GET `/vendor-requests` - List requests
  - GET `/vendor-requests/:id` - Get single request
  - POST `/vendor-requests` - Create request
  - PATCH `/vendor-requests/:id` - Update request
  - DELETE `/vendor-requests/:id` - Withdraw request

- `vendor-upload` - File upload handling
  - POST `/vendor-upload` - Upload attendance file

## Development

### Adding New Components

Use Shadcn/ui CLI to add components:

```bash
bunx shadcn@latest add [component-name]
```

### Code Style

- TypeScript strict mode enabled
- ESLint configured
- Follow React best practices
- Use TanStack Query for data fetching
- Use TanStack Form for form management

## Security Considerations

- RLS policies enforce data isolation
- File upload validation (type, size)
- Input sanitization on all forms
- CORS configured for Edge Functions
- Role-based access control

## License

Private project
