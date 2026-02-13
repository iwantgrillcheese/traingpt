'use client';

import { notFound } from 'next/navigation';
import { getAllBlogPosts } from '../../../lib/blog-posts';
import { marked } from 'marked';

// Next 15.5+ treats `params` as a Promise, so we destructure it async.
type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params; // unwrap the Promise
  const post = getAllBlogPosts().find((p) => p.slug === slug);

  if (!post) return notFound();

  const htmlContent = marked.parse(post.content);

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
