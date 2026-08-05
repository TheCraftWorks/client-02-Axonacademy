import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/site/Layout";
import { ArrowUpRight, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { api, getAssetUrl } from "@/lib/api";
import { BlogDetailModal } from "@/components/home/BlogDetailModal";

export const Route = createFileRoute("/blog")({ component: Blog });

function Blog() {
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  useEffect(() => {
    const loadBlogs = async () => {
      try {
        const res = await api.get("/public/blogs");
        if (res.success && res.blogs) {
          setPosts(res.blogs);
        }
      } catch (err) {
        console.error("Error fetching blogs:", err);
      }
    };
    loadBlogs();
  }, []);

  const hero = posts.find(p => p.featured) || posts[0] || null;
  const rest = hero ? posts.filter(p => p !== hero) : [];

  return (
    <PublicLayout>
      <section className="py-20 lg:py-28 bg-navy">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— Journal</div>
          <h1 className="mt-3 max-w-3xl font-display text-4xl lg:text-7xl font-extrabold text-white tracking-[-0.03em] leading-[1.02]">
            Notes from the<br/><span className="text-gold">clinical floor.</span>
          </h1>

          {/* Featured — guard against null hero */}
          {hero && (
            <article
              className="mt-14 group grid lg:grid-cols-2 gap-8 rounded-3xl border border-gray-100 bg-white overflow-hidden cursor-pointer shadow-sm"
              onClick={() => setSelectedPost(hero)}
            >
              <div className={`relative aspect-[16/10] lg:aspect-auto ${hero.image ? "" : "bg-gradient-to-br from-navy to-sky"} overflow-hidden`}>
                {hero.image ? (
                  <img src={getAssetUrl(hero.image)} alt={hero.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-noise opacity-30" />
                )}
                <span className="absolute top-4 left-4 rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-navy">Featured · {hero.cat || hero.category}</span>
              </div>
              <div className="p-8 lg:p-10 flex flex-col justify-center">
                <div className="text-xs text-gray-500 font-mono">{hero.date} · {hero.read || hero.readTime} read</div>
                <h2 className="mt-3 font-display text-2xl lg:text-4xl font-extrabold text-navy leading-tight">{hero.title}</h2>
                <p className="mt-4 text-gray-600 leading-relaxed line-clamp-3">{hero.excerpt}</p>
                <button className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-navy w-fit group-hover:gap-3 transition-all">
                  Read article <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          )}

          {/* Grid */}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map(p => (
              <article
                key={p._id || p.id || p.title}
                className="group rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg transition-all flex flex-col cursor-pointer hover:-translate-y-1"
                onClick={() => setSelectedPost(p)}
              >
                <div className={`relative aspect-[16/10] ${p.image ? "" : "bg-gradient-to-br from-navy to-emerald"} overflow-hidden`}>
                  {p.image ? (
                    <img src={getAssetUrl(p.image)} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-noise opacity-30" />
                  )}
                  <span className="absolute top-4 left-4 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-navy">{p.cat || p.category}</span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="text-xs text-gray-500 font-mono flex items-center gap-2">{p.date} <span>·</span> <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{p.read || p.readTime} read</span></div>
                  <h3 className="mt-3 font-display font-bold text-navy leading-snug">{p.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{p.excerpt}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Detail Modal */}
      {selectedPost && (
        <BlogDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </PublicLayout>
  );
}