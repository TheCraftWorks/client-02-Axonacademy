const HOSPITALS = ["Apollo", "Fortis", "Manipal", "Max Healthcare", "Narayana Health", "Medanta", "Aster", "Columbia Asia", "Kokilaben", "AIIMS", "Tata Memorial", "Lilavati"];

export function Partners() {
  const row = [...HOSPITALS, ...HOSPITALS];
  return (
    <section className="py-8 lg:py-12 border-y border-border bg-card">
      <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-8">
        <div className="text-center mb-10">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-plum">— 06 / Partners</div>
          <h3 className="mt-3 font-display text-xl lg:text-2xl font-semibold text-plum-dark">
            Where our students build careers
          </h3>
        </div>
      </div>
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
        <div className="flex w-max marquee gap-12 hover:[animation-play-state:paused]">
          {row.map((n, i) => (
            <div key={i} className="shrink-0 grid place-items-center">
              <span className="font-display text-2xl lg:text-3xl font-bold text-plum-dark/30 hover:text-plum-dark transition-colors whitespace-nowrap">
                {n}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
