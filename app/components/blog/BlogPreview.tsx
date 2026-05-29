import Link from 'next/link';
import { getLatestBlogPosts } from '@/lib/blog-posts';

export default function BlogPreview() {
  const posts = getLatestBlogPosts(3);

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Resources</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
              Learn how to train smarter.
            </h2>
          </div>
          <Link href="/blog" className="text-sm font-medium text-zinc-600 underline underline-offset-4 transition hover:text-zinc-950">
            View all articles
          </Link>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300"
            >
              <p className="text-xs text-zinc-400">{post.tag} · {post.date}</p>
              <h3 className="mt-8 text-xl font-semibold tracking-tight text-zinc-950 group-hover:underline group-hover:decoration-zinc-300 group-hover:underline-offset-4">
                {post.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{post.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
