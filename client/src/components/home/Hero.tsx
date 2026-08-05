import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Sparkles, Activity, HeartPulse, Pill, Microscope } from "lucide-react";

const stats = [
  { v: "1,000+", l: "Sidhha Aspirants Mentored " },
  { v: "15,000", l: "MCQs Practiced" },
  { v: "70+", l: "PG Rank holders / AMO selection" },
  
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-6 lg:pt-3 pb-2 lg:pb-16">
      {/* Background Video */}
      <video
        src="/doctormobile.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 -z-10 w-full h-full object-cover md:hidden"
      />
      <video
        src="/doctorforlaptop.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 -z-10 w-full h-full object-cover hidden md:block"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-5 lg:px-8">
        <div className="grid md:grid-cols-12 gap-6 md:gap-8 lg:gap-12 items-center">
          <div className="md:col-span-7 order-1 md:order-1">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-bold text-gold shadow-black/40 shadow-lg"
            >
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              India's #1 Siddha & AYUSH Academy
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-5 font-display font-extrabold text-white text-balance text-[40px] sm:text-[56px] lg:text-[68px] leading-[1.02] tracking-[-0.03em]"
              style={{ textShadow: '0 4px 12px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.6)' }}
            >
          Prepare. Practice.Crack{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-gold"> AIAPGET & MRB.</span>
                <span className="absolute inset-x-0 bottom-1 h-3 lg:h-4 bg-gold/30 -z-0 rounded-sm" />
              </span>{" "}
  
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-6 max-w-xl text-base lg:text-lg text-white font-semibold leading-relaxed"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)' }}
            >
              Master high-yield concepts, smart revision strategies, daily MCQs, grand tests, and expert guidance to secure top ranks in AIAPGET & MRB Siddha examinations.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to="/courses"
                className="group inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-navy hover:bg-gold/90 transition"
              >
                Start Learning Today
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <button className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 backdrop-blur px-6 py-3.5 text-sm font-bold text-white hover:bg-black/30 transition">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-navy">
                  <Play className="h-3 w-3 fill-current" />
                </span>
                Explore Courses
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl"
            >
              {stats.map((s) => (
                <div key={s.l}>
                  <div className="font-display text-2xl lg:text-3xl font-bold text-gold" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                    {s.v}
                  </div>
                  <div className="mt-1 text-xs lg:text-sm text-white font-medium" style={{ textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}>{s.l}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}