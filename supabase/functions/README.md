# Edge Functions Configuration

Edge Functions use environment variables for Supabase credentials to keep secrets out of the code.

## Required Environment Variables

The following environment variables must be set on your host server:

- **SUPABASE_URL**: Your Supabase instance URL (e.g., `https://supabase.hkra.org.hk`)
- **SUPABASE_ANON_KEY**: Your anonymous/public key (found in Settings > API)
- **SUPABASE_SERVICE_ROLE_KEY**: Your service role key (found in Settings > API) - **Keep this secret!**
- **RESEND_API_KEY**: (Optional) Resend API key for sending email notifications. If not set, emails will be skipped.
- **FROM_EMAIL**: (Optional) Email address to send from (defaults to `noreply@hkra.org.hk`)

## Setting Environment Variables

### Option 1: Docker Environment Variables

If deploying via Docker, set environment variables in your Docker container:

```bash
# Set environment variables in the container
docker exec -it YOUR_CONTAINER sh -c 'export SUPABASE_URL="https://supabase.hkra.org.hk"'
docker exec -it YOUR_CONTAINER sh -c 'export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"'
docker exec -it YOUR_CONTAINER sh -c 'export SUPABASE_ANON_KEY="your-anon-key"'
docker exec -it YOUR_CONTAINER sh -c 'export RESEND_API_KEY="re_xxxxxxxxxxxxx"'
docker exec -it YOUR_CONTAINER sh -c 'export FROM_EMAIL="noreply@hkra.org.hk"'

# Or use docker-compose.yml
environment:
  - SUPABASE_URL=https://supabase.hkra.org.hk
  - SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  - SUPABASE_ANON_KEY=your-anon-key
  - RESEND_API_KEY=re_xxxxxxxxxxxxx
  - FROM_EMAIL=noreply@hkra.org.hk
```

### Option 2: System Environment Variables

Set environment variables on your host system before running the Edge Functions:

```bash
# Linux/macOS
export SUPABASE_URL="https://supabase.hkra.org.hk"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SUPABASE_ANON_KEY="your-anon-key"
export RESEND_API_KEY="re_xxxxxxxxxxxxx"
export FROM_EMAIL="noreply@hkra.org.hk"

# Windows PowerShell
$env:SUPABASE_URL="https://supabase.hkra.org.hk"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:SUPABASE_ANON_KEY="your-anon-key"
$env:RESEND_API_KEY="re_xxxxxxxxxxxxx"
$env:FROM_EMAIL="noreply@hkra.org.hk"
```

### Option 3: .env File with Docker Compose

**Note:** Deno Edge Functions don't automatically read `.env` files. For Docker deployments, you need to configure Docker Compose to load the `.env` file.

#### Method 3A: Using Docker Compose `env_file`

Create a `.env` file in your project root (or where your `docker-compose.yml` is located):

```env
SUPABASE_URL=https://supabase.hkra.org.hk
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=noreply@hkra.org.hk
```

Then update your `docker-compose.yml` to use the `.env` file:

```yaml
services:
  supabase_functions:
    env_file:
      - .env # Loads all variables from .env file
    # OR specify individual variables:
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - FROM_EMAIL=${FROM_EMAIL}
```

#### Method 3B: Loading .env into Existing Docker Container

**Important:** Docker containers cannot have their environment variables changed after they're created. You have two options:

**Option 1: Recreate the Container (Recommended)**

Stop and recreate your container with environment variables from `.env`:

```bash
# Stop and remove existing container
docker stop YOUR_CONTAINER
docker rm YOUR_CONTAINER

# Recreate with environment variables from .env
docker run -d \
  --name YOUR_CONTAINER \
  --env-file .env \
  your-image:tag
```

**Option 2: Use Helper Script**

Use the provided helper script to see how to recreate your container:

```bash
# Linux/macOS
./scripts/load-env-to-docker.sh YOUR_CONTAINER

# Windows PowerShell
.\scripts\load-env-to-docker.ps1 YOUR_CONTAINER
```

**Note:** The helper script will show you the exact command needed to recreate your container with the environment variables. For persistent environment variables, always use Docker Compose with `env_file` or recreate the container with `--env-file`.

## Deploy Functions

After setting environment variables, deploy the functions:

```bash
# Using Docker
docker cp supabase/functions/vendor-requests YOUR_CONTAINER:/home/deno/functions/
docker cp supabase/functions/vendor-upload YOUR_CONTAINER:/home/deno/functions/
docker cp supabase/functions/vendor-info YOUR_CONTAINER:/home/deno/functions/
docker restart YOUR_CONTAINER

# Or use the deployment script
./scripts/deploy-functions.sh
```

## Email Notifications

The `vendor-requests` function automatically sends email notifications when a new CPD request is created:

1. **Confirmation Email**: Sent to the requestor confirming receipt of their request
2. **Admin Notification**: Sent to all users with `role: 'admin'` in their user metadata

### Setting Up Email (Resend)

1. Sign up for a Resend account at https://resend.com
2. Create an API key in your Resend dashboard
3. Verify your sending domain (or use Resend's test domain for development)
4. Set the `RESEND_API_KEY` environment variable
5. Optionally set `FROM_EMAIL` (defaults to `noreply@hkra.org.hk`)

**Note**: If `RESEND_API_KEY` is not set, email sending will be skipped and logged as a warning. This allows the system to function without email configured.

### Admin Users

Admin users are identified by having `role: 'admin'` in their user metadata. To set a user as admin:

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'admin@example.com';
```

## Security Note

⚠️ **Important**:

- The service role key bypasses Row Level Security (RLS) and has full access to your database
- Never commit environment variables or secrets to version control
- Use secure methods to set environment variables on your host server
- Rotate keys regularly
- Consider using a secrets management system for production deployments
- Keep your Resend API key secure - it has access to send emails from your domain

## Troubleshooting

If you get "Vendor record not found" errors:

1. Verify the vendor record exists: `SELECT * FROM vendors WHERE user_id = 'USER_ID';`
2. Check that the `user_id` in the vendors table matches your authenticated user's ID
3. Ensure the service role key is correct and has proper permissions
