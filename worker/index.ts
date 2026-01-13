/**
 * Cloudflare Worker for serving the React SPA
 * This worker handles SPA routing by serving index.html for all routes
 *
 * Note: Cloudflare Pages is recommended for static sites.
 * Use this worker only if you need custom routing logic or Workers-specific features.
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle static assets
    if (url.pathname.startsWith('/assets/') ||
        url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/)) {
      // Try to fetch the asset from the static assets
      // In production, these should be served from Cloudflare's CDN
      return fetch(request);
    }

    // For SPA routing, serve index.html for all non-asset requests
    // This ensures React Router can handle client-side routing
    const indexHtml = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));

    // If index.html exists, return it with proper headers
    if (indexHtml.ok) {
      return new Response(indexHtml.body, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Fallback: return 404
    return new Response('Not Found', { status: 404 });
  },
};

interface Env {
  ASSETS: Fetcher;
}



