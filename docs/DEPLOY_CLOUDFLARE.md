# Deploying to Cloudflare

This guide covers deploying the HKRA Vendor Portal to Cloudflare Pages or Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://www.cloudflare.com)
2. **Wrangler CLI**: Install Cloudflare's CLI tool
3. **Environment Variables**: Your Supabase credentials

## Installation

Install Wrangler CLI globally:

```bash
npm install -g wrangler
# or
bun add -g wrangler
```

Or use it via npx/bunx:

```bash
npx wrangler --version
# or
bunx wrangler --version
```

## Option 1: Cloudflare Pages (Recommended)

Cloudflare Pages is the recommended deployment method for static sites and SPAs. It provides:

- Automatic HTTPS
- Global CDN
- Preview deployments
- Custom domains
- Environment variables management

### Step 1: Login to Cloudflare

```bash
npm run cf:login
# or
wrangler login
```

This will open your browser to authenticate with Cloudflare.

### Step 2: Build the Application

```bash
npm run build
# or
bun run build
```

This creates the `dist` folder with your production build.

### Step 3: Deploy to Cloudflare Pages

**Method A: Using Wrangler CLI**

```bash
npm run deploy:pages
# or
wrangler pages deploy dist
```

**Method B: Using Cloudflare Dashboard**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > **Create Application** > **Pages** > **Upload Assets**
3. Upload the `dist` folder contents
4. Configure your project settings

**Method C: Connect Git Repository (Recommended for CI/CD)**

1. Go to Cloudflare Dashboard > Workers & Pages > Create Application > Pages
2. Select **Connect to Git**
3. Connect your GitHub/GitLab repository
4. Configure build settings:
   - **Build command**: `npm run build` or `bun run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (or leave empty)
5. Add environment variables (see below)

### Step 4: Configure Environment Variables

In Cloudflare Dashboard:

1. Go to your Pages project
2. Navigate to **Settings** > **Environment Variables**
3. Add the following variables:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: For Cloudflare Pages, environment variables prefixed with `VITE_` are automatically injected during build time. Make sure to:

- Add them to **Production** environment
- Add them to **Preview** environment if you want preview deployments to work
- Rebuild after adding variables

### Step 5: Configure Custom Domain (Optional)

1. Go to your Pages project > **Custom domains**
2. Click **Set up a custom domain**
3. Follow the instructions to add your domain

### Step 6: Configure SPA Routing

The `public/_redirects` file ensures that all routes serve `index.html` for React Router to handle client-side routing. Cloudflare Pages automatically reads this file.

If you need custom redirects, you can also configure them in:

- **Settings** > **Functions** > **Redirects** in Cloudflare Dashboard

## Option 2: Cloudflare Workers

Use Cloudflare Workers if you need:

- Custom routing logic
- Workers-specific features (Durable Objects, KV, etc.)
- More control over request/response handling

### Step 1: Configure Worker

Update `wrangler.toml`:

```toml
name = "hkra-vendor-cpd"
compatibility_date = "2024-01-01"
main = "worker/index.ts"

# For custom domain routing
routes = [
  { pattern = "your-domain.com/*", zone_name = "your-domain.com" }
]

# Environment variables
[vars]
VITE_SUPABASE_URL = "your_supabase_url"
VITE_SUPABASE_ANON_KEY = "your_anon_key"
```

### Step 2: Build and Deploy

```bash
npm run build
npm run deploy:worker
# or
wrangler deploy
```

### Step 3: Upload Static Assets

For Workers, you need to upload static assets separately:

1. Use Cloudflare R2 (Object Storage) for assets
2. Or use Cloudflare Pages for assets and Workers for API routes
3. Or bundle assets with the Worker (not recommended for large apps)

**Recommended**: Use Cloudflare Pages for the frontend and Workers only if you need custom server-side logic.

## Local Development with Cloudflare

Test your deployment locally:

```bash
npm run build
npm run cf:dev
# or
wrangler pages dev dist
```

This starts a local server that mimics Cloudflare Pages behavior.

## Environment Variables

### Required Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Setting Secrets (Workers)

For sensitive data in Workers, use secrets:

```bash
wrangler secret put VITE_SUPABASE_URL
wrangler secret put VITE_SUPABASE_ANON_KEY
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: hkra-vendor-cpd
          directory: dist
```

### GitLab CI Example

Create `.gitlab-ci.yml`:

```yaml
image: node:20

stages:
  - build
  - deploy

build:
  stage: build
  script:
    - npm install -g bun
    - bun install
    - bun run build
  artifacts:
    paths:
      - dist
    expire_in: 1 hour

deploy:
  stage: deploy
  image: node:20
  script:
    - npm install -g wrangler
    - wrangler pages deploy dist --project-name=hkra-vendor-cpd
  only:
    - main
```

## Troubleshooting

### Build Fails

- Check that all environment variables are set
- Verify `VITE_` prefix is used for variables needed at build time
- Check build logs in Cloudflare Dashboard

### Routing Issues

- Ensure `public/_redirects` file exists with `/* /index.html 200`
- Check Cloudflare Pages Functions settings
- Verify React Router is configured correctly

### Environment Variables Not Working

- Rebuild after adding variables (Cloudflare Pages)
- Check variable names match exactly (case-sensitive)
- Verify variables are set for the correct environment (Production/Preview)

### CORS Issues

If you encounter CORS issues with Supabase:

1. Check Supabase CORS settings
2. Verify your domain is whitelisted in Supabase
3. Check Cloudflare Workers/Pages CORS headers if using custom domains

## Performance Optimization

### Enable Cloudflare Features

1. **Auto Minify**: Settings > Builds & deployments > Auto Minify (HTML, CSS, JS)
2. **Brotli Compression**: Automatically enabled
3. **Caching**: Configure cache headers in `vite.config.ts` or Cloudflare Dashboard

### Cache Headers

Add to `vite.config.ts`:

```typescript
export default defineConfig({
  // ... existing config
  build: {
    rollupOptions: {
      output: {
        // Add cache headers for assets
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
});
```

## Monitoring

- **Analytics**: Cloudflare Pages provides built-in analytics
- **Logs**: View logs in Cloudflare Dashboard > Workers & Pages > Your Project > Logs
- **Performance**: Use Cloudflare Web Analytics or integrate with your analytics tool

## Support

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Community](https://community.cloudflare.com/)


