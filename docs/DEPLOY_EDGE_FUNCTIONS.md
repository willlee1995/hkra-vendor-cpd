# Deploying Edge Functions to Self-Hosted Supabase

This guide explains how to deploy Edge Functions to a self-hosted Supabase instance.

**Important:** Self-hosted Supabase doesn't use `project-ref` (that's only for Supabase Cloud). Use Docker-based deployment methods instead.

## Quick Start (Docker)

### Step 1: Find Your Container Name

**Windows PowerShell:**

```powershell
.\scripts\find-functions-container.ps1
```

**Linux/Mac:**

```bash
./scripts/find-functions-container.sh
```

**Or manually:**

```bash
docker ps | grep -i function
# Look for containers like: supabase_functions, supabase-edge-functions, etc.
```

### Step 2: Deploy Functions

**Windows PowerShell:**

```powershell
.\scripts\deploy-functions.ps1 -DockerContainer YOUR_CONTAINER_NAME
```

**Linux/Mac:**

```bash
export DOCKER_CONTAINER=YOUR_CONTAINER_NAME
./scripts/deploy-functions.sh
```

**Or manually:**

```bash
# Copy functions to container
docker cp supabase/functions/vendor-requests YOUR_CONTAINER_NAME:/home/deno/functions/
docker cp supabase/functions/vendor-upload YOUR_CONTAINER_NAME:/home/deno/functions/

# Restart container
docker restart YOUR_CONTAINER_NAME
```

## Prerequisites

1. Docker access to your self-hosted Supabase instance
2. Edge Functions code ready in `supabase/functions/` directory
3. Know your Docker container name (usually `supabase_functions` or similar)

## Method 1: Using Supabase CLI (Without Project-Ref)

**Note:** Self-hosted Supabase doesn't use `project-ref`. Use direct URL and credentials instead.

### Step 1: Set Environment Variables

```bash
export SUPABASE_URL=https://your-supabase-instance.com
export SUPABASE_ANON_KEY=your-anon-key
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export SUPABASE_DB_URL=postgresql://postgres:password@your-host:5432/postgres
```

### Step 2: Deploy Functions Directly

For self-hosted Supabase, you typically need to copy functions manually or use Docker volumes. The Supabase CLI's `deploy` command is designed for Supabase Cloud and requires a project-ref.

**Alternative:** Use the Docker method (Method 2) or file copy method below.

## Method 2: Direct File Copy (Docker Compose) - **Recommended for Self-Hosted**

This is the most reliable method for self-hosted Supabase instances.

If you're running Supabase via Docker Compose:

### Step 1: Locate Your Supabase Functions Directory

Your self-hosted Supabase instance should have a functions directory, typically:

- `/var/lib/docker/volumes/supabase_functions/_data/` (Docker volumes)
- Or mounted at a custom path in your `docker-compose.yml`

### Step 2: Copy Functions

```bash
# Copy functions to the Supabase functions directory
cp -r supabase/functions/vendor-requests /path/to/supabase/functions/
cp -r supabase/functions/vendor-upload /path/to/supabase/functions/

# Or if using Docker volumes
docker cp supabase/functions/vendor-requests supabase_functions:/var/lib/docker/volumes/supabase_functions/_data/
docker cp supabase/functions/vendor-upload supabase_functions:/var/lib/docker/volumes/supabase_functions/_data/
```

### Step 3: Restart Supabase Functions Service

```bash
# Restart the functions service
docker-compose restart supabase_functions

# Or restart the entire stack
docker-compose restart
```

## Method 3: Using Docker Compose Volume Mount

### Step 1: Update docker-compose.yml

Add a volume mount for functions:

```yaml
services:
  supabase_functions:
    volumes:
      - ./supabase/functions:/home/deno/functions:ro
      # Or for development (writable):
      # - ./supabase/functions:/home/deno/functions
```

### Step 2: Restart Services

```bash
docker-compose up -d
```

## Method 4: Manual Deployment via API

If your self-hosted Supabase has the Management API enabled:

### Step 1: Create Deployment Script

Create a script to deploy via API:

```bash
#!/bin/bash

FUNCTION_NAME="vendor-requests"
FUNCTION_PATH="./supabase/functions/vendor-requests"
SUPABASE_URL="https://your-supabase-instance.com"
SERVICE_ROLE_KEY="your-service-role-key"

# Create a tarball of the function
tar -czf ${FUNCTION_NAME}.tar.gz -C ${FUNCTION_PATH} .

# Deploy via API
curl -X POST \
  "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}/deploy" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/gzip" \
  --data-binary "@${FUNCTION_NAME}.tar.gz"

# Clean up
rm ${FUNCTION_NAME}.tar.gz
```

## Method 5: Using Deno Deploy (Alternative)

If your self-hosted Supabase doesn't support Edge Functions natively, you can deploy to Deno Deploy and proxy requests:

1. Deploy functions to Deno Deploy
2. Update your frontend to call Deno Deploy URLs instead
3. Or set up a reverse proxy in your Supabase instance

## Verification

After deployment, verify your functions are working:

```bash
# Test the function endpoint
curl -X GET \
  "https://your-supabase-instance.com/functions/v1/vendor-requests" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Or use the Supabase CLI
supabase functions serve vendor-requests --no-verify-jwt
```

## Environment Variables

Make sure your Edge Functions have access to environment variables:

### For Docker Compose

Add to `docker-compose.yml`:

```yaml
services:
  supabase_functions:
    environment:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
```

### For CLI Deployment

Set secrets:

```bash
supabase secrets set SUPABASE_URL=https://your-instance.com
supabase secrets set SUPABASE_ANON_KEY=your-anon-key
```

## Troubleshooting

### Function Not Found

- Check that the function directory exists in the correct location
- Verify the function name matches the directory name
- Check Supabase logs: `docker-compose logs supabase_functions`

### Authentication Errors

- Ensure `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly
- Check CORS headers in your function code
- Verify RLS policies allow function access

### Function Not Updating

- Clear Deno cache: `deno cache --reload`
- Restart the functions service
- Check file permissions

## Quick Deploy Script

Create `scripts/deploy-functions.sh`:

```bash
#!/bin/bash

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://your-supabase-instance.com}"
PROJECT_REF="${PROJECT_REF:-your-project-ref}"

echo "Deploying Edge Functions to ${SUPABASE_URL}..."

# Deploy vendor-requests function
echo "Deploying vendor-requests..."
supabase functions deploy vendor-requests \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt || {
    echo "Failed to deploy vendor-requests"
    exit 1
  }

# Deploy vendor-upload function
echo "Deploying vendor-upload..."
supabase functions deploy vendor-upload \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt || {
    echo "Failed to deploy vendor-upload"
    exit 1
  }

echo "✅ All functions deployed successfully!"
```

Make it executable:

```bash
chmod +x scripts/deploy-functions.sh
```

Run it:

```bash
./scripts/deploy-functions.sh
```
