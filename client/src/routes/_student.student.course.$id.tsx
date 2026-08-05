import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Lock, CheckCircle2, FileText, Download, MessageSquare, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_student/student/course/$id")({
  component: CoursePlayer,
});

const MODULES = [
  { t: "Foundations of Patient Care", done: true, lessons: 6 },
  { t: "Vital Signs & Monitoring", done: true, lessons: 8 },
  { t: "Medication Administration", done: true, lessons: 7 },
  { t: "IV Cannulation Technique", done: false, current: true, lessons: 9 },
  { t: "Infection Control", done: false, lessons: 6 },
  { t: "Emergency Response", done: false, lessons: 10, locked: true },
];

function CoursePlayer() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-6">
      <Link to="/student/my-courses" className="inline-flex items-center gap-1 text-sm text-plum hover:text-plum-dark">
        <ChevronLeft className="h-4 w-4" /> Back to courses
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {/* Player */}
          <div className="rounded-3xl overflow-hidden bg-plum-dark aspect-video relative grid place-items-center group">
            <div className="absolute inset-0 bg-gradient-to-br from-plum-dark via-plum to-plum-dark opacity-90" />
            <div className="absolute inset-0 bg-grid opacity-20" />
            <button className="relative grid h-20 w-20 place-items-center rounded-full bg-lime text-plum-dark group-hover:scale-110 transition-transform">
              <Play className="h-8 w-8 fill-plum-dark ml-1" />
            </button>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="h-1 rounded-full bg-cream/20 overflow-hidden">
                <div className="h-full bg-lime w-[34%]" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-cream/70 font-mono">
                <span>04:12</span><span>12:08</span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs uppercase tracking-widest text-plum">Module 4 · Lesson 3</div>
            <h1 className="mt-1 font-display text-2xl font-bold text-plum-dark">Vein Selection & Site Preparation</h1>
            <p className="mt-2 text-sm text-muted-foreground">Course: <span className="text-plum-dark capitalize">{id.replaceAll("-", " ")}</span> · Dr. Meera Iyer</p>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 border-b border-border">
            {["Overview", "Resources", "Q&A", "Notes"].map((t, i) => (
              <button key={t} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${i===0 ? "border-plum-dark text-plum-dark" : "border-transparent text-muted-foreground hover:text-plum-dark"}`}>{t}</button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-white border border-border p-6 space-y-4">
            <p className="text-sm text-foreground/80 leading-relaxed">
              In this lesson you'll learn the systematic approach to selecting the optimal vein,
              proper aseptic technique for site preparation, and the clinical reasoning behind
              each choice. Includes hands-on demonstrations on the simulation arm.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icon: FileText, l: "Lesson PDF" },
                { icon: Download, l: "Practice sheet" },
                { icon: MessageSquare, l: "Ask instructor" },
              ].map((r) => (
                <button key={r.l} className="flex items-center gap-3 rounded-xl bg-secondary p-3 hover:bg-plum-dark hover:text-cream transition-colors text-left">
                  <r.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{r.l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modules sidebar */}
        <aside className="rounded-3xl bg-white border border-border p-5 h-fit lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-plum-dark">Course content</h3>
            <span className="text-xs font-mono text-muted-foreground">46% complete</span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-lime w-[46%]" />
          </div>
          <div className="mt-5 space-y-2">
            {MODULES.map((m, i) => (
              <div
                key={m.t}
                className={`rounded-xl p-3 border ${
                  m.current
                    ? "bg-plum-dark text-cream border-plum-dark"
                    : m.locked
                      ? "border-border opacity-60"
                      : "border-border hover:border-plum/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold ${
                    m.done ? "bg-lime text-plum-dark" : m.current ? "bg-lime text-plum-dark" : "bg-secondary text-plum-dark"
                  }`}>
                    {m.done ? <CheckCircle2 className="h-4 w-4" /> : m.locked ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${m.current ? "text-cream" : "text-plum-dark"}`}>{m.t}</div>
                    <div className={`text-[11px] ${m.current ? "text-cream/70" : "text-muted-foreground"}`}>{m.lessons} lessons</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
