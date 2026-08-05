import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/site/Layout";
import { useState, useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Star, Clock, Users, X } from "lucide-react";

export const Route = createFileRoute("/courses")({ component: CoursesPage });

import { getPublicPrograms, type ProgramCourse, getAssetUrl } from "@/lib/api";

const DURATIONS  = ["1 Month", "3 Months", "6 Months", "1 Year"];
const MODES      = ["Online", "Offline", "Hybrid"];

function CoursesPage() {
  const [courses, setCourses] = useState<ProgramCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const specialties = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach(c => {
      const val = c.specialty || c.category;
      if (val) {
        const trimmed = val.trim();
        const key = trimmed.toLowerCase();
        if (!map.has(key)) {
          map.set(key, trimmed);
        }
      }
    });
    return Array.from(map.values()).sort();
  }, [courses]);

  const [q, setQ] = useState("");
  const [spec, setSpec] = useState<string[]>([]);
  const [dur, setDur] = useState<string[]>([]);
  const [mode, setMode] = useState<string[]>([]);
  const [sort, setSort] = useState("popular");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getPublicPrograms()
      .then(data => setCourses(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let r = courses.filter(c =>
      (!q || c.title.toLowerCase().includes(q.toLowerCase())) &&
      (spec.length === 0 || spec.some(s => s.trim().toLowerCase() === (c.specialty || c.category || "").trim().toLowerCase())) &&
      (dur.length === 0 || dur.includes(c.duration || "6 Months"))
      // Note: Backend doesn't have mode field exposed in ProgramCourse currently, so we skip mode filtering for now
    );
    if (sort === "price-asc") r = [...r].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") r = [...r].sort((a, b) => b.price - a.price);
    if (sort === "rating") r = [...r].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return r;
  }, [q, spec, dur, sort, courses]);

  const FilterPanel = (
    <div className="space-y-7">
      <FilterGroup label="Specialty" options={specialties} selected={spec} onChange={setSpec} />
      <FilterGroup label="Duration"  options={DURATIONS}   selected={dur}  onChange={setDur} />
      <FilterGroup label="Mode"      options={MODES}       selected={mode} onChange={setMode} />
      {(spec.length || dur.length || mode.length) > 0 && (
        <button onClick={() => { setSpec([]); setDur([]); setMode([]); }} className="text-xs font-semibold text-plum underline">Clear all filters</button>
      )}
    </div>
  );

  return (
    <PublicLayout>
      {/* Page header */}
      <section className="bg-navy border-b border-navy-800">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-14 lg:py-20">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— Catalog</div>
          <h1 className="mt-3 font-display text-4xl lg:text-6xl font-extrabold text-white tracking-tight">
            Find the course that<br/>becomes your career.
          </h1>
          <div className="mt-8 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gold" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-full border border-white/10 bg-white/5 pl-12 pr-4 py-3.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 lg:px-8 py-12">
        <div className="flex gap-10">
          <aside className="hidden lg:block w-64 shrink-0 sticky top-24 self-start">
            {FilterPanel}
          </aside>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-6 gap-3">
              <div className="text-sm text-gray-500">{filtered.length} courses</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setOpen(true)} className="lg:hidden inline-flex items-center gap-2 rounded-full border border-navy/20 px-4 py-2 text-sm font-bold text-navy">
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                </button>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold focus:outline-none text-navy">
                  <option value="popular">Most Popular</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Rating</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {loading ? (
                <div className="col-span-full py-12 text-center text-gray-400">Loading courses...</div>
              ) : filtered.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-400">No courses match your criteria.</div>
              ) : (
                filtered.map(c => <CourseCard key={c.id} c={c} />)
              )}
            </div>
          </div>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-auto rounded-t-3xl bg-white p-6">
            <div className="flex justify-between items-center mb-6">
              <span className="font-display font-extrabold text-navy text-lg">Filters</span>
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-navy/10 text-navy"><X className="h-4 w-4" /></button>
            </div>
            {FilterPanel}
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

function FilterGroup({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; }) {
  return (
    <div>
      <h4 className="font-display font-bold text-sm text-navy uppercase tracking-wider mb-3">{label}</h4>
      <div className="space-y-2">
        {options.map(o => {
          const on = selected.includes(o);
          return (
            <label key={o} className="flex items-center gap-3 cursor-pointer text-sm group">
              <span className={`grid h-5 w-5 place-items-center rounded-md border transition ${on ? "bg-navy border-navy" : "border-gray-300 group-hover:border-navy/50"}`}>
                {on && <span className="h-2 w-2 bg-gold rounded-sm" />}
              </span>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? selected.filter(s => s !== o) : [...selected, o])} />
              <span className={on ? "text-navy font-bold" : "text-gray-600"}>{o}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CourseCard({ c }: { c: ProgramCourse }) {
  return (
    <div className="group rounded-3xl border border-border bg-card overflow-hidden hover:-translate-y-1 hover:border-plum-dark/30 transition-all flex flex-col h-full">
      <div className="relative aspect-[16/10] bg-gradient-to-br from-plum to-plum-dark overflow-hidden shrink-0">
        {c.image ? (
          <img src={getAssetUrl(c.image)} alt={c.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-noise opacity-30" />
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="rounded-full bg-cream/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-plum-dark">
            {c.specialty || c.category || "Course"}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 rounded-full bg-cream/95 px-2.5 py-1 text-[11px] font-bold text-plum-dark inline-flex items-center gap-1">
          <Star className="h-3 w-3 fill-lime text-lime" /> {c.rating || 4.5}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display text-base font-semibold text-plum-dark line-clamp-2 leading-snug">{c.title}</h3>
        {c.description && <p className="text-xs text-foreground/60 mt-1.5 line-clamp-2">{c.description}</p>}
        <div className="mt-3 flex items-center gap-4 text-xs text-foreground/65">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.duration || "6 Months"}</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {((c.title.length * 123) % 2000) + 300}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase">Online</span>
        </div>
        <div className="mt-auto pt-5 flex items-end justify-between">
          <div>
            <div className="text-xs text-foreground/50 line-through">₹{Math.round(c.price * 1.2).toLocaleString()}</div>
            <div className="font-display text-xl font-bold text-plum-dark">₹{c.price.toLocaleString()}</div>
          </div>
          <Link to={"/enroll"} className="rounded-full bg-plum-dark px-4 py-2 text-xs font-semibold text-cream hover:bg-plum transition">Enroll →</Link>
        </div>
      </div>
    </div>
  );
}
