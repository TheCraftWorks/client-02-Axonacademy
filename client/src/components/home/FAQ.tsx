import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const faqs = [
  { q: "What types of courses are available for AIAPGET & MRB ?"
, a: "We offer both Regular Courses and Test Batch Programs tailored for AIAPGET & MRB preparation." },
  { q: "Are AIAPGET & MRB conducted together or separately?", a: "Both are handled through separate classes, with different teaching patterns and strategies for each exam." },
  { q: "Will modern study materials be provided?", a: "Yes! We provide updated and high-quality modern study materials for effective preparation." },
  { q: "Are recorded classes available?", a: "Yes, recorded classes are available so you can learn and revise anytime." },
  { q: "Are live classes conducted? When do they take place?", a: "Yes! Live interactive classes are conducted every Sunday. Time: 8:00 PM – 9:00 PM." },
  { q: "Can I pay the course fee in installments (EMI)?", a: "Yes, you can pay through 3–4 flexible installments for your convenience." },
  
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-10 lg:py-16 bg-secondary/40">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <div className="text-center mb-12">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-plum">— 09 / Questions</div>
          <h2 className="mt-3 font-display text-3xl lg:text-5xl font-bold text-plum-dark tracking-tight">
            Frequently asked.
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className={`rounded-2xl border bg-card transition-colors ${isOpen ? "border-plum-dark" : "border-border"}`}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-display font-semibold text-plum-dark">{f.q}</span>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${isOpen ? "bg-gold text-plum-dark" : "bg-secondary text-plum-dark"}`}>
                    {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-foreground/75">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
