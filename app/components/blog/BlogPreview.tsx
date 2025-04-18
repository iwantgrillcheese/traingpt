'use client';

import Image from 'next/image';
import Link from 'next/link';
import { blogPosts } from '@/lib/blog-data';

export default function BlogPreview() {
  const heroPost = blogPosts[0];
  const topRightPosts = blogPosts.slice(1, 3);
  const latestNews = blogPosts.slice(3, 9);
  const stories = blogPosts.slice(0, 3);

  return (
    <section className="px-6 py-16 max-w-7xl mx-auto text-gray-900">
      <h2 className="text-3xl font-bold mb-10">From the Blog</h2>

      {/* Hero + 2 stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Hero */}
        <Link href={`/blog/${heroPost.slug}`} className="group col-span-2">
          <div className="overflow-hidden rounded-xl">
            <Image
              src={heroPost.image}
              alt={heroPost.title}
              width={800}
              height={500}
              className="w-full h-64 md:h-96 object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <p className="text-sm text-gray-500 mt-4">{heroPost.tag} • {heroPost.date}</p>
          <h3 className="text-2xl font-semibold mt-2">{heroPost.title}</h3>
          <p className="text-gray-600 mt-1 text-sm">{heroPost.description}</p>
        </Link>

        {/* Top Right Posts */}
        <div className="flex flex-col gap-6">
          {topRightPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col"
            >
              <div className="overflow-hidden rounded-xl">
                <Image
                  src={post.image}
                  alt={post.title}
                  width={400}
                  height={200}
                  className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="text-sm text-gray-500 mt-3">{post.tag} • {post.date}</p>
              <h4 className="font-medium leading-snug mt-1">{post.title}</h4>
            </Link>
          ))}
        </div>
      </div>

      {/* Latest News grid */}
      <div className="mb-16">
        <h3 className="text-xl font-semibold mb-6">Latest news</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {latestNews.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group"
            >
              <div className="overflow-hidden rounded-xl">
                <Image
                  src={post.image}
                  alt={post.title}
                  width={400}
                  height={200}
                  className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="text-sm text-gray-500 mt-3">{post.tag} • {post.date}</p>
              <h4 className="font-medium leading-snug mt-1">{post.title}</h4>
            </Link>
          ))}
        </div>
      </div>

      {/* Stories row */}
      <div>
        <h3 className="text-xl font-semibold mb-6">Stories</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {stories.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group"
            >
              <div className="overflow-hidden rounded-xl">
                <Image
                  src={post.image}
                  alt={post.title}
                  width={400}
                  height={300}
                  className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="text-sm text-gray-500 mt-3">{post.tag} • {post.date}</p>
              <h4 className="font-medium leading-snug mt-1">{post.title}</h4>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
