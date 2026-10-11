import { Quote, Play, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Derive the base server URL (without /api/v1) so we can build stream URLs
const API_BASE = (() => {
  const runtime =
    import.meta.env.VITE_API_URL ||
    import.meta.env.BACKEND_URL ||
    (typeof process !== 'undefined' ? process.env.VITE_API_URL || process.env.BACKEND_URL : '');
  const base = (runtime?.trim() || '/api/v1').replace(/\/+$/,'');
  return base;
})();

const STUDENT_FEEDBACKS = [
  {
    name: "RANJITH KUMAR S",
    roll: "AXP26164",
    review: "Axon Med Academy has been a great support for my preparation! The video lectures are very useful, and the pnemonics  make difficult concepts much easier to remember. The weekend discussion classes are informative, and the staff are very friendly and supportive.The weekly tests are really helpful to track our progress and identify areas that need improvement.",
    initials: "RK",
  },
  {
    name: "RAJA SANKARI",
    roll: "AXP2615",
    review: "I am very happy with the guidance and support provided by Axon med academy. The pneumonics, regular tests, discussion classes, and revision sessions are very helpful in improving my understanding and progress.\n\nThe practice of posting questions regularly keeps us engaged and helps us revise important topics frequently.\n\nThe faculties are very supportive, approachable, and encouraging.\n\nOverall, it is a great learning environment with excellent teaching methods and consistent support. I am truly grateful to all the faculties and the academy for helping me progress in my studies.",
    initials: "RS",
  },
  {
    name: "G. Naveena",
    roll: "AXP2622",
    review: "My experience at Axon Med Academy has been really good. The teaching is clear and easy to understand. The faculty are supportive, approachable, and always willing  to clarify doubts.\n\nThe academy provides a positive learning environment and helps students stay focused and confident in their preparation. The study materials, guidance, and regular support are also very helpful.\n\nI’m grateful to the entire Axon Med Academy team for their continuous support and guidance.🌟📚",
    initials: "GN",
  },
  {
    name: "HARINI.L",
    roll: "AXP8269",
    review: "It's the only academy that doesn't focus on payment it focuses only on the way to make each and every one  success, cares individual, efforts to level up all the range of students wheather they are slow learner or smart one ,this academy only focus to level up each and every one.\n\nClasses and pneumonics are good apart from that telegram that created and maintained by the academy was the best one, it contains a lot and alot of questions with different aspects covering almost all the possible ways.\n\nI am very grateful to this academy and to the staffs.",
    initials: "HL",
  },
];

const FALLBACK_ITEMS = [
  { name: "Priya Krishnan", roll: "Staff Nurse · Apollo Hospitals", review: "From classroom to a top hospital in 8 months. The proctored exams gave my employer real confidence.", initials: "PK", image: null },
  { name: "Arjun Reddy",    roll: "OT Technician · Manipal",review: "The hands-on OT simulation modules made my transition to the operating theatre seamless. Top-tier faculty.", initials: "AR", image: null },
  { name: "Sneha Pillai",   roll: "Lab Technician · Fortis",review: "I started with ₹999/month EMI and now earn 6× that monthly. The placement team was relentlessly supportive.", initials: "SP", image: null },
];

function VideoThumbnail({ video, streamUrl, className }: { video: any; streamUrl: string; className?: string }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    vid.preload = 'metadata';
    vid.src = streamUrl;
    vid.currentTime = 0.5; // seek to 0.5 sec

    vid.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = vid.videoWidth || 640;
      canvas.height = vid.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        setThumb(canvas.toDataURL('image/jpeg', 0.6));
      }
      vid.remove();
    }, { once: true });

    vid.addEventListener('error', () => { vid.remove(); }, { once: true });

    return () => {
      vid.remove();
    };
  }, [streamUrl]);

  return (
    <div className={`absolute inset-0 ${className || ''}`}>
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-plum to-plum-dark" />
      )}
      <div className="absolute inset-0 bg-noise opacity-30" />
    </div>
  );
}

export function Testimonials() {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [reviewVideos, setReviewVideos] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);

  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/public/testimonials")
      .then((res) => { if (res.success && res.testimonials?.length > 0) setTestimonials(res.testimonials); })
      .catch(() => {});

    api.get("/public/review-videos")
      .then((res) => { if (res.success) setReviewVideos(res.videos || []); })
      .catch(() => {});
  }, []);

  // Build a streaming URL for the active video using the proxy endpoint
  const getStreamUrl = (video: any) => {
    if (!video) return '';
    // If video has an _id, use the presigned streaming endpoint
    if (video._id) {
      return `${API_BASE}/public/review-videos/${video._id}/stream`;
    }
    // Fallback to the stored videoUrl (legacy)
    return video.videoUrl || '';
  };

  const allFeedbacks = [
    ...STUDENT_FEEDBACKS,
    ...(testimonials.length > 0 ? testimonials : FALLBACK_ITEMS),
  ];
  const marqueeItems = [...allFeedbacks, ...allFeedbacks];

  return (
    <>
      <section className="py-10 lg:py-16 bg-light-gray overflow-hidden">
        <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-8">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
            <div className="max-w-xl">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— 05 / Voices</div>
              <h2 className="mt-3 font-display text-3xl lg:text-5xl font-extrabold text-navy tracking-tight">
                500 careers.<br />One academy.
              </h2>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-white border border-gray-200 px-4 py-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-gold text-gold" />)}
              </div>
              <span className="text-sm font-bold text-navy">4.9 / 5</span>
              <span className="text-xs text-gray-500">· 500+ reviews</span>
            </div>
          </div>

          {/* Student Feedbacks Right-to-Left Moving Marquee */}
          <div className="relative -mx-5 lg:-mx-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] py-4">
            <div
              className="flex w-max marquee gap-6 hover:[animation-play-state:paused]"
              style={{ animationDuration: "50s" }}
            >
              {marqueeItems.map((t: any, i: number) => {
                const isNavy = i % 2 === 1;
                return (
                  <div
                    key={`${t.roll || t.name}-${i}`}
                    className={`w-[360px] sm:w-[420px] lg:w-[460px] shrink-0 relative rounded-2xl p-7 border flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                      isNavy ? "bg-navy text-white border-navy" : "bg-white text-navy border-gray-100 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <Quote className={`h-8 w-8 ${isNavy ? "text-gold" : "text-navy/20"}`} />
                        <div className="flex">
                          {[...Array(5)].map((_, s) => (
                            <Star key={s} className="h-3.5 w-3.5 fill-gold text-gold" />
                          ))}
                        </div>
                      </div>
                      <p className={`text-sm lg:text-base leading-relaxed whitespace-pre-line ${isNavy ? "text-white/90" : "text-gray-700"}`}>
                        "{t.review}"
                      </p>
                    </div>

                    <div className={`mt-8 flex items-center gap-3 pt-5 border-t ${isNavy ? "border-white/10" : "border-gray-100"}`}>
                      <div
                        className={`h-11 w-11 overflow-hidden rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0 ${
                          isNavy ? "bg-gold text-navy" : "bg-navy text-white"
                        }`}
                      >
                        {t.image ? (
                          <img src={t.image} alt={t.name} className="h-full w-full object-cover rounded-full" />
                        ) : (
                          t.initials || t.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className={`font-semibold text-sm ${isNavy ? "text-white" : "text-navy"}`}>{t.name}</div>
                        <div className={`text-xs ${isNavy ? "text-white/65" : "text-gray-500"}`}>{t.roll}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Video testimonial strip */}
          {reviewVideos.length > 0 && (
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {reviewVideos.slice(0, 3).map((v: any) => (
                <button
                  key={v._id || v.id}
                  onClick={() => { setActiveVideo(v); setVideoError(null); }}
                  className="group relative aspect-video overflow-hidden rounded-2xl"
                >
                  {/* Video thumbnail (captured first frame client-side) */}
                  <VideoThumbnail
                    video={v}
                    streamUrl={getStreamUrl(v)}
                    className="rounded-2xl"
                  />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-gold text-navy group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  </div>
                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-left">
                    <div className="text-cream text-xs font-semibold truncate">{v.title}</div>
                    {v.studentName && (
                      <div className="text-cream/65 text-[10px] truncate">{v.studentName}{v.roll ? ` · ${v.roll}` : ""}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Fallback video strip if no videos uploaded yet */}
          {reviewVideos.length === 0 && (
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <button key={i} className="group relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy">
                  <div className="absolute inset-0 bg-noise opacity-30" />
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-gold text-navy group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 fill-current" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white text-xs font-semibold">Watch student story #{i}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Video modal overlay */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="relative w-full max-w-3xl bg-navy rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Video player */}
            <div className="aspect-video bg-black">
              <video
                key={activeVideo._id || activeVideo.id}
                src={getStreamUrl(activeVideo)}
                controls
                autoPlay
                className="w-full h-full object-contain"
                onError={() => setVideoError("Failed to load video. The video may not be accessible.")}
              />
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <p className="text-white text-sm px-4 text-center">{videoError}</p>
                </div>
              )}
            </div>

            {/* Video info */}
            <div className="px-6 py-4">
              <h3 className="font-display font-bold text-white text-base">{activeVideo.title}</h3>
              {activeVideo.studentName && (
                <p className="text-white/60 text-xs mt-1">
                  {activeVideo.studentName}{activeVideo.roll ? ` · ${activeVideo.roll}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
