'use client';

import React from 'react';

export default function BlogHome() {
  return (
    <main className="bg-white text-black">
      {/* Top spacing to mimic OpenAI's blank space intro */}
      <div className="h-32 md:h-48"></div>

      {/* FEATURED POST SECTION */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 mb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {/* Featured Post Full-Width */}
            <div className="aspect-video bg-gray-200 rounded-xl mb-6"></div>
            <h2 className="text-3xl font-semibold mb-2">OpenAI o3 and o4-mini</h2>
            <p className="text-gray-500 mb-2 text-sm">Release · 6 min read</p>
            <p className="text-gray-700 text-base">Explore our latest models and what they mean for the future of AI performance and efficiency.</p>
          </div>

          {/* Carousel-like right column (3 stacked items) */}
          <div className="flex flex-col gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="aspect-square bg-gray-100 rounded-xl mb-2"></div>
                <p className="text-sm text-gray-500 mb-1">Product · 4 min read</p>
                <h3 className="font-medium text-md leading-snug">Sample blog title {i}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LATEST NEWS GRID */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 mb-24">
        <h2 className="text-2xl font-semibold mb-8">Latest news</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <div className="aspect-square bg-gray-100 rounded-xl mb-3"></div>
              <p className="text-sm text-gray-500 mb-1">Publication · Apr {10 + i}, 2025</p>
              <h3 className="font-medium text-lg leading-tight">Mock post title {i + 1}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* STORIES SECTION */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 mb-32">
        <h2 className="text-2xl font-semibold mb-8">Stories</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="aspect-[4/3] bg-gray-200 rounded-xl mb-4"></div>
              <p className="text-sm text-gray-500 mb-1">ChatGPT · Feb 4, 2025 · 3 min read</p>
              <h3 className="font-medium text-lg">Story title {i + 1}</h3>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
