import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, MapPin, Building2, TrendingUp } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_admin/admin/placements")({
  component: AdminPlacements,
});

function AdminPlacements() {
  return (
    <div className="space-y-6 text-cream">
      <div>
        <h1 className="font-display text-3xl font-bold">Placements</h1>
        <p className="text-cream/60 text-sm mt-1">Hospital partnerships and student hiring</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: "Partner hospitals", v: "214", i: Building2 },
          { l: "Open positions", v: "486", i: Briefcase },
          { l: "Placement rate", v: "95.2%", i: TrendingUp },
          { l: "Cities covered", v: "32", i: MapPin },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-lime/15 text-lime mb-3"><s.i className="h-4 w-4" /></div>
            <div className="font-display text-2xl font-bold">{s.v}</div>
            <div className="text-[10px] uppercase tracking-widest text-cream/60 mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DarkCard>
          <h3 className="font-display font-bold text-lg">Active recruiters</h3>
          <div className="mt-4 space-y-3">
            {[
              { h: "Apollo Hospitals", o: 24, c: "Bengaluru, Chennai", s: "Interviewing" },
              { h: "Fortis Healthcare", o: 18, c: "Mumbai, Delhi", s: "Offers extended" },
              { h: "Manipal Hospitals", o: 15, c: "Bengaluru", s: "Shortlisting" },
              { h: "Max Healthcare", o: 22, c: "Delhi NCR", s: "On-site visit" },
              { h: "Narayana Health", o: 12, c: "Bengaluru", s: "JD review" },
            ].map((p) => (
              <div key={p.h} className="rounded-xl bg-cream/5 p-4 flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-lime text-plum-dark font-bold">{p.h.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.h}</div>
                  <div className="text-[11px] text-cream/60">{p.c} · {p.s}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-lime text-xl">{p.o}</div>
                  <div className="text-[9px] uppercase tracking-widest text-cream/50">Open</div>
                </div>
              </div>
            ))}
          </div>
        </DarkCard>

        <DarkCard>
          <h3 className="font-display font-bold text-lg">Recent placements</h3>
          <div className="mt-4 space-y-3">
            {[
              { s: "Karthik Rao", r: "Staff Nurse · Apollo", w: "₹4.8L", t: "2d" },
              { s: "Meera Joshi", r: "OT Asst · Fortis", w: "₹4.2L", t: "3d" },
              { s: "Vikrant Singh", r: "Lab Tech · Manipal", w: "₹3.8L", t: "5d" },
              { s: "Asha Pillai", r: "ICU Nurse · Max", w: "₹5.2L", t: "1w" },
              { s: "Rohit Sen", r: "Radiology · Narayana", w: "₹4.4L", t: "1w" },
            ].map((p) => (
              <div key={p.s} className="flex items-center gap-3 border-b border-cream/10 pb-3 last:border-0">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-lime/15 text-lime text-xs font-bold">{p.s.split(" ").map(w=>w[0]).join("")}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{p.s}</div>
                  <div className="text-[11px] text-cream/60">{p.r}</div>
                </div>
                <div className="text-right">
                  <div className="text-lime font-bold text-sm">{p.w}</div>
                  <div className="text-[10px] text-cream/50">{p.t} ago</div>
                </div>
              </div>
            ))}
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
