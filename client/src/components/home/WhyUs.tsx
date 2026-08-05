import { Video, ShieldCheck, Award, Briefcase, Users, CreditCard } from "lucide-react";

const items = [
  { icon: Video, title: "Live + Recorded Interactive Classes", desc: "Flexible learning at your own pace with HD recordings of every session." },
  { icon: ShieldCheck, title: "AIAPGET & MRB Patern Mock Tests", desc: "Complete syllabus tests that simulate the actual (AIAPGET & MRB) exam pattern with rank analysis." },
  { icon: Award, title: "Consise Notes & Smart Revision PDFs", desc: "Lifetime-verifiable credentials with QR-based proof of authenticity." },
  { icon: Briefcase, title: "Rank-Oriented Preparation", desc: "Telegram support, regular live discussion sessions, and updated notes & materials for every student." },
  { icon: Users, title: "Experienced Sidhha Faculty", desc: "Simplify complex concepts through mnemonics, story-based learning, and bilingual explanations." },
  { icon: CreditCard, title: "Affordable Fees & EMI Available", desc: "Begin your career journey for as little as ₹999/month, no hidden fees." },
];
  const NAVY = "#0B1F3A";
const GOLD = "#F4B400";
const SKY  = "#2D9CDB";
export function WhyUs() {
  return (
    <section className="py-10 lg:py-16 bg-light-gray">
      <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-8">
        <div className="">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-gold">— 02 / Why Axon</div>
           <h2 className="mt-3 font-display text-2xl lg:text-5xl font-bold tracking-tight" style={{ color: NAVY }}>
             Proven Result. Expert Mentorship. Strategic Preparation.<br/>
              <span style={{ color: GOLD }}>Empowering Siddha aspirants to achive Top ranks, AMO Selectikn and PG admission with Confidence...</span>
            </h2>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3 sm:grid-cols-2">
          {items.map((it) => (
            <div key={it.title} className="group bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100">
              <div className="group-hover:scale-110 transition-transform duration-300">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-navy text-white">
                  <it.icon className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-6 font-display text-lg font-bold text-navy group-hover:text-gold transition-colors">
                {it.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {it.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
