import { getAllBlogPosts } from '@/lib/blog-posts';

export default function sitemap() {
  const base = 'https://traingpt.co';
  const staticUrls = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/plan`, changeFrequency: 'daily', priority: 0.9 },
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
