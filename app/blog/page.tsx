'use client';

import React from 'react';
import { blogPosts } from '@/lib/blog-data';
import Link from 'next/link';
import Image from 'next/image';

export default function BlogHome() {
  const sortedPosts = blogPosts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const featured = sortedPosts[0];
  const secondary = sortedPosts.slice(1, 4);
  const grid = sortedPosts.slice(4, 12);

  return (
    <main className="bg-white text-black">
      <div className="h-32 md:h-48"></div>

      {/* FEATURED POST */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 mb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Link href={`/blog/${featured.slug}`}>
              <div className="aspect-video bg-gray-200 rounded-xl overflow-hidden mb-6 relative">
                <Image
                  src={featured.image}
                  alt={featured.title}
                  fill
                  className="object-cover"
                />
              </div>
              <h2 className="text-3xl font-semibold mb-2">{featured.title}</h2>
              <p className="text-gray-500 mb-2 text-sm">
                {featured.tag} · {featured.date}
              </p>
              <p className="text-gray-700 text-base">{featured.description}</p>
            </Link>
          </div>

          {/* RIGHT SIDEBAR POSTS */}
          <div className="flex flex-col gap-6">
            {secondary.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <div>
                  <div className="aspect-square bg-gray-100 rounded-xl mb-2 relative overflow-hidden">
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">
                    {post.tag} · {post.date}
                  </p>
                  <h3 className="font-medium text-md leading-snug">{post.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* GRID OF POSTS */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 mb-32">
        <h2 className="text-2xl font-semibold mb-8">Latest Posts</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {grid.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <div>
                <div className="aspect-square bg-gray-100 rounded-xl mb-3 relative overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <p className="text-sm text-gray-500 mb-1">
                  {post.tag} · {post.date}
                </p>
                <h3 className="font-medium text-lg leading-tight">{post.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
