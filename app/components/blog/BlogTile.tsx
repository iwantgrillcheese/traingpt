type BlogPost = {
    title: string;
    description: string;
    tag: string;
    date: string;
  };
  
  export default function BlogTile({ title, description, tag, date }: BlogPost) {
    return (
      <div className="rounded-xl border p-5 hover:shadow transition">
        <div className="text-sm text-zinc-500">{tag}</div>
        <h3 className="text-xl font-semibold mt-1">{title}</h3>
        <p className="text-zinc-600 mt-2">{description}</p>
        <div className="text-xs text-zinc-400 mt-3">{date}</div>
      </div>
    );
  }
  