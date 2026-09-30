export const prerender = true;

export function GET({ site }: { site: URL }) {
  const sitemap = new URL('sitemap-index.xml', new URL(import.meta.env.BASE_URL, site));
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemap.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
