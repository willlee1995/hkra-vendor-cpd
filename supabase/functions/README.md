# Edge Functions Configuration

Edge Functions use environment variables for Supabase credentials to keep secrets out of the code.

## Required Environment Variables

The following environment variables must be set on your host server:

- **SUPABASE_URL**: Your Supabase instance URL (e.g., `https://supabase.hkra.org.hk`)
- **SUPABASE_ANON_KEY**: Your anonymous/public key (found in Settings > API)
- **SUPABASE_SERVICE_ROLE_KEY**: Your service role key (found in Settings > API) - **Keep this secret!**

## Setting Environment Variables

### Option 1: Docker Environment Variables

If deploying via Docker, set environment variables in your Docker container:

```bash
# Set environment variables in the container
docker exec -it YOUR_CONTAINER sh -c 'export SUPABASE_URL="https://supabase.hkra.org.hk"'
docker exec -it YOUR_CONTAINER sh -c 'export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"'
docker exec -it YOUR_CONTAINER sh -c 'export SUPABASE_ANON_KEY="your-anon-key"'

# Or use docker-compose.yml
environment:
  - SUPABASE_URL=https://supabase.hkra.org.hk
  - SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  - SUPABASE_ANON_KEY=your-anon-key
```

### Option 2: System Environment Variables

Set environment variables on your host system before running the Edge Functions:

```bash
# Linux/macOS
export SUPABASE_URL="https://supabase.hkra.org.hk"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SUPABASE_ANON_KEY="your-anon-key"

# Windows PowerShell
$env:SUPABASE_URL="https://supabase.hkra.org.hk"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:SUPABASE_ANON_KEY="your-anon-key"
```

### Option 3: .env File (if supported)

Some deployment methods support `.env` files. Create a `.env` file in your functions directory:

```env
SUPABASE_URL=https://supabase.hkra.org.hk
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

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

## Security Note

⚠️ **Important**:
- The service role key bypasses Row Level Security (RLS) and has full access to your database
- Never commit environment variables or secrets to version control
- Use secure methods to set environment variables on your host server
- Rotate keys regularly
- Consider using a secrets management system for production deployments

## Troubleshooting

If you get "Vendor record not found" errors:
1. Verify the vendor record exists: `SELECT * FROM vendors WHERE user_id = 'USER_ID';`
2. Check that the `user_id` in the vendors table matches your authenticated user's ID
3. Ensure the service role key is correct and has proper permissions

