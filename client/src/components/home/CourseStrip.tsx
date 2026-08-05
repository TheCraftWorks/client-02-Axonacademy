import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, Users, Star, BookOpen, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getPublicPrograms, type ProgramCourse, getAssetUrl } from "@/lib/api";

export function CourseStrip() {
  const [programs, setPrograms] = useState<ProgramCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicPrograms()
      .then(data => setPrograms(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);
  const NAVY = "#0B1F3A";
const GOLD = "#F4B400";
const SKY  = "#2D9CDB";


  return (
    <section className="py-10 lg:py-16">
      <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-8">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div className="max-w-xl">
            <div className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: SKY }}>— 01 / Programs</div>
            <h2 className="mt-3 font-display text-3xl lg:text-5xl font-bold tracking-tight" style={{ color: NAVY }}>
              Courses That Help <br/>
              <span style={{ color: GOLD }}>You Crack AIAPGET & MRB</span>
            </h2>
          </div>
          <Link to="/courses" className="group inline-flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all" style={{ color: NAVY }}>
            View all 30+ courses
            <ArrowUpRight className="h-4 w-4 group-hover:rotate-45 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: SKY }} />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.slice(0, 6).map((c, i) => {
              const color = i % 2 === 0 ? "from-gold to-sky" : "from-sky to-gold";
              return (
                <div key={c.id} className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 hover:-translate-y-1 transition-all"
                  style={{ borderColor: 'rgba(45,156,219,0.15)' }}>
                  <div className={`absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br ${color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      {c.image ? (
                        <div className="h-12 w-12 overflow-hidden rounded-2xl" style={{ backgroundColor: NAVY }}>
                          <img src={getAssetUrl(c.image)} alt={c.title} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="grid h-12 w-12 place-items-center rounded-2xl text-white animate-pulse" style={{ backgroundColor: NAVY }}>
                          <BookOpen className="h-5 w-5" style={{ color: GOLD }} />
                        </div>
                      )}
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: 'rgba(11,31,58,0.06)', color: NAVY }}>
                        {c.specialty || c.category || "Course"}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-lg font-semibold transition" style={{ color: NAVY }}>
                      {c.title}
                    </h3>
                    <div className="mt-3 flex items-center gap-4 text-xs text-foreground/60">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.duration || "6 Months"}</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {(c.title.length * 123 % 2000) + 300}</span>
                      <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-[#F4B400] text-[#F4B400]" /> {c.rating || 4.5}</span>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                      <div>
                        <div className="text-xs text-foreground/50">Starting at</div>
                        <div className="font-display text-xl font-bold" style={{ color: NAVY }}>₹{c.price.toLocaleString()}</div>
                      </div>
                      <Link to="/enroll" className="rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 active:scale-95"
                        style={{ backgroundColor: NAVY }}>
                        Enroll →
                      </Link>
                      
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
