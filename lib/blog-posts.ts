import { blogPosts as staticBlogPosts } from '@/lib/blog-data';
import generatedPosts from '@/data/seo-generated-posts.json';

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  tag: string;
  date: string;
  image: string;
  content: string;
  heroImageKeyword?: string;
};

const generated = (generatedPosts as BlogPost[]) || [];

export function getAllBlogPosts(): BlogPost[] {
  return [...staticBlogPosts, ...generated].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getLatestBlogPosts(limit = 3): BlogPost[] {
  return getAllBlogPosts().slice(0, limit);
}
