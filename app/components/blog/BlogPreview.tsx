'use client';

import Link from 'next/link';
import { getLatestBlogPosts } from '@/lib/blog-posts';

export default function BlogPreview() {
  const posts = getLatestBlogPosts(3);

  return (
    <section className="px-6 py-16 max-w-7xl mx-auto text-gray-900">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold">From the Blog</h2>
        <Link href="/blog" className="text-sm text-gray-600 hover:text-black underline">
          View all
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition"
          >
            <p className="text-xs text-gray-500 mb-2">{post.tag} • {post.date}</p>
            <h3 className="text-lg font-semibold leading-snug mb-2">{post.title}</h3>
            <p className="text-sm text-gray-600">{post.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
