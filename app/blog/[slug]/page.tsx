'use client';

import { notFound } from 'next/navigation';
import { blogPosts } from '../../../lib/blog-data';
import { marked } from 'marked';
import type { PageProps } from 'next';

export default function BlogPostPage({ params }: PageProps<{ slug: string }>) {
  const post = blogPosts.find((p) => p.slug === params.slug);

  if (!post) return notFound();

  const htmlContent = marked.parse(post.content); // Converts markdown to real HTML

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-gray-800">
      <p className="text-sm text-gray-400 mb-2">
        {post.tag} • {post.date}
      </p>
      <h1 className="text-4xl font-bold mb-6">{post.title}</h1>
      <img
        src={post.image}
        alt={post.title}
        className="w-full rounded-xl mb-10 shadow"
      />
      <div className="prose prose-lg mx-auto text-gray-700">
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    </div>
  );
}
