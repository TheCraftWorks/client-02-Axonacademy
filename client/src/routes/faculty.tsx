import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/site/Layout";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Star, GraduationCap, Award } from "lucide-react";

export const Route = createFileRoute("/faculty")({ component: FacultyPage });

function FacultyPage() {
  const [faculty, setFaculty] = useState<any[]>([]);

  useEffect(() => {
    api.get("/public/faculty")
      .then((res) => {
        if (res.success) {
          const list = res.facultyList || [];
          // Deduplicate by _id or name
          const seen = new Map<string, any>();
          const unique = list.filter((f: any) => {
            const key = f._id || f.name;
            if (seen.has(key)) return false;
            seen.set(key, f);
            return true;
          });
          setFaculty(unique);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-28 bg-navy">
        <div className="absolute inset-0 -z-10 bg-grid opacity-20" />
        <div className="absolute -z-10 top-0 right-0 h-[500px] w-[500px] rounded-full bg-gold/20 blur-3xl" />
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— Faculty</div>
          <h1 className="mt-3 max-w-4xl font-display text-4xl lg:text-7xl font-extrabold text-white tracking-[-0.03em] leading-[1.02]">
           Crack  with the Best Mindset. <span className="text-gold">AIAPGET & MRB</span> industry.
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-white/80 leading-relaxed">

​Learn from elite SIDDHA professionals and veteran educators who transform complex medical concepts into easy mnemonics and high-yield insights.
          </p>
        </div>
      </section>

      {/* Faculty Grid */}
      <section className="py-20 lg:py-28 bg-light-gray">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          {faculty.length === 0 ? (
            <div className="text-center py-20 text-gray-400">Loading faculty...</div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {faculty.map((f: any) => (
                <div
                  key={f._id || f.name}
                  className="rounded-2xl bg-white border border-gray-100 p-6 flex flex-col items-center text-center hover:shadow-xl transition-shadow hover:-translate-y-1"
                >
                  {/* Avatar */}
                  <div className="h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-navy to-sky flex items-center justify-center font-display font-bold text-2xl text-white shrink-0">
                    {f.image ? (
                      <img src={f.image} alt={f.name} className="h-full w-full object-cover" />
                    ) : (
                      f.initials || f.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                    )}
                  </div>

                  {/* Name & Role */}
                  <h3 className="mt-4 font-display font-extrabold text-navy text-lg">{f.name}</h3>
                  <p className="text-sm text-gray-500">{f.role}</p>

                  {/* Specialty */}
                  {f.specialty && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-navy bg-navy/10 rounded-full px-3 py-1.5">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {f.specialty}
                    </div>
                  )}

                  {/* Years & Rating */}
                  <div className="mt-4 w-full flex items-center justify-between border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Award className="h-3.5 w-3.5" />
                      {f.years || 0}+ yrs
                    </div>
                    {f.rating && (
                      <div className="flex items-center gap-1 text-xs font-bold text-navy">
                        <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                        {f.rating}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}