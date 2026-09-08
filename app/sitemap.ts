import { getAllBlogPosts } from '@/lib/blog-posts';

export default function sitemap() {
  const base = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://traingpt.co').replace(/\/$/, '');
  const staticUrls = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/preview`, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${base}/free-triathlon-training-plan`, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${base}/free-70-3-training-plan`, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${base}/free-ironman-training-plan`, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${base}/plan`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.8 },
  ];

  const blogUrls = getAllBlogPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticUrls, ...blogUrls];
}
