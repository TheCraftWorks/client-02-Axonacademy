import { ClipboardCheck, GraduationCap, ScrollText, Award, Briefcase } from "lucide-react";

const steps = [
  { icon: ClipboardCheck, title: "Enroll", desc: "Choose your course and start your preparation." },
  { icon: GraduationCap,  title: "Learn",  desc: "Attend live classes and access recorded sessions anytime." },
  { icon: ScrollText,     title: "Practice",   desc: "Solve daily MCQs, PYQs, and full-length mock tests." },
  { icon: Award,          title: "Revise",desc: "Rapid revision, mnemonics, and high-yield notes." },
  { icon: Briefcase,      title: "Crack the Exam", desc: " Secure a Top Rank in AIAPGET & MRB.", highlight: true },
];

export function LearningPath() {
  return (
    <section className="py-10 lg:py-16 bg-light-gray">
      <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— 07 / Journey</div>
          <h2 className="mt-3 font-display text-3xl lg:text-5xl font-extrabold text-navy tracking-tight">
            Your Road to <span className="text-sky">AIAPGET</span> & <span className="text-gold">MRB Success</span>
          </h2>
        </div>

        <div className="mt-16 relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-px border-t-2 border-dashed border-navy/20" />

          <div className="grid lg:grid-cols-5 gap-8 lg:gap-4">
            {steps.map((s, i) => (
              <div key={s.title} className="relative flex flex-col items-center text-center">
                <div className={`relative grid h-24 w-24 place-items-center rounded-full ${s.highlight ? "bg-gold text-navy shadow-lg" : "bg-white border-2 border-navy/10 text-navy"}`}>
                  <s.icon className="h-9 w-9" />
                  <span className={`absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full font-mono text-xs font-bold ${s.highlight ? "bg-navy text-gold" : "bg-navy text-white"}`}>
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-navy">{s.title}</h3>
                <p className="mt-2 max-w-[180px] text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
