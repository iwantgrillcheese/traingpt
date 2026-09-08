/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://traingpt.co',
  generateRobotsTxt: true,
  changefreq: 'weekly',
  sitemapSize: 5000,
};
