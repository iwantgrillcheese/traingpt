export default function robots() {
  const base = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://traingpt.co').replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
