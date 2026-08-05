import { X, Clock } from "lucide-react";
import { getAssetUrl } from "@/lib/api";

interface BlogDetailModalProps {
  post: any;
  onClose: () => void;
}

export function BlogDetailModal({ post, onClose }: BlogDetailModalProps) {
  if (!post) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/40 text-white grid place-items-center hover:bg-black/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Image */}
        {post.image && (
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={getAssetUrl(post.image)}
              alt={post.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="p-8 lg:p-10">
          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-lime bg-lime/10 px-2.5 py-1 rounded-full">
              {post.cat || post.category}
            </span>
            <span className="text-xs text-foreground/55 font-mono">
              {post.date}
            </span>
            <span className="text-xs text-foreground/55 font-mono inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.read || post.readTime} read
            </span>
          </div>

          {/* Title */}
          <h2 className="mt-5 font-display text-2xl lg:text-4xl font-bold text-plum-dark leading-tight">
            {post.title}
          </h2>

          {/* Full excerpt / body */}
          <div className="mt-6 text-foreground/80 leading-relaxed text-base space-y-4">
            <p>{post.excerpt}</p>
            <p className="text-foreground/60 italic">
              This is a preview of the full article. The complete content with
              detailed analysis, charts, and references would be displayed here
              in a production implementation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}