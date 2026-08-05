import { useEffect, useRef, useState } from "react";

const stats = [
  { v: 15, suffix: "+", l: "Government Selections" },
  { v: 200, suffix: "+", l: "Success Stories" },
  { v: 10, suffix: "+", l: " Experts Faculties" },
];

function useCountUp(target: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const dur = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return val;
}

export function PlacementBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setActive(true), { threshold: 0.3 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative py-12 lg:py-20 overflow-hidden bg-navy text-white">
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-125 w-225 rounded-full bg-gold/15 blur-3xl" />
      <CrossPattern />

      <div className="relative mx-auto w-full max-w-[1400px] px-5 lg:px-8">
        <div className="max-w-2xl mb-14">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— 03 / Outcomes</div>
          <h2 className="mt-3 font-display text-3xl lg:text-5xl font-extrabold tracking-tight">
          Results That Speak for Our <br/>
            <span className="text-gold">Students' Success</span>
          </h2>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => <StatCell key={s.l} {...s} active={active} />)}
        </div>
      </div>
    </section>
  );
}

function StatCell({ v, suffix, l, active }: { v: number ; suffix: string; l: string; active: boolean }) {
  const count = useCountUp(v, active);
  return (
    <div className="border-t border-gold/20 pt-6">
      <div className="font-display text-5xl lg:text-6xl font-bold text-white tracking-tight">
        {count.toLocaleString()}<span className="text-gold">{suffix}</span>
      </div>
      <div className="mt-3 text-sm text-white/70">{l}</div>
    </div>
  );
}

function CrossPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.04]" aria-hidden>
      <defs>
        <pattern id="crosses" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M28 18h4v8h8v4h-8v8h-4v-8h-8v-4h8z" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#crosses)" />
    </svg>
  );
}
