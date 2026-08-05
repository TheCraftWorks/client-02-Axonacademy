import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function CtaBlock() {
  return (
    <section className="py-10 lg:py-16">
      <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-navy text-white p-10 lg:p-20">
          <div className="absolute inset-0 bg-noise opacity-40 pointer-events-none" />
          <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-sky/20 blur-3xl" />

          <div className="relative max-w-2xl">
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— Next Cohort Open</div>
            <h2 className="mt-4 font-display text-4xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Your hospital badge is<br />
              <span className="bg-gold text-navy px-3 rounded-lg">8 months away.</span>
            </h2>
            <p className="mt-6 text-lg text-white/80 max-w-lg">
              Limited seats per cohort. Lock yours today with a refundable ₹999 hold — no commitment required.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/courses" className="group inline-flex items-center gap-2 rounded-full bg-gold px-7 py-4 text-sm font-bold text-navy hover:bg-gold/90 transition">
                Reserve My Seat
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-7 py-4 text-sm font-bold text-white hover:bg-white/10 transition">
                Talk to a Counsellor
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
