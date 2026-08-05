import { createFileRoute } from "@tanstack/react-router";
import { Award, ShieldCheck, Lock, ExternalLink } from "lucide-react";
import { useClassroomStore, computeCertificates } from "@/lib/classroomStore";

export const Route = createFileRoute("/_student/student/certificates")({
  component: Certificates,
});

function Certificates() {
  const { currentUser, classrooms } = useClassroomStore();
  const name = currentUser?.name || "Student Name";
  const studentId = currentUser?.id || "";

  const certs = computeCertificates(classrooms, studentId);
  const enrolledClassrooms = classrooms.filter(c => c.students.some(s => s.id === studentId && s.status === "active"));
  const inProgress = enrolledClassrooms.filter(c => !certs.some(cert => cert.classroomId === c.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-plum-dark">Certificates</h1>
          <p className="text-sm text-muted-foreground mt-1">Blockchain-verified credentials awarded upon course completion</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          All certificates verified on-chain
        </div>
      </div>

      <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2">
        {certs.map((c) => (
          <div key={c.classroomId} className="rounded-2xl md:rounded-3xl border border-border bg-white shadow-sm">
            <div className="relative aspect-[4/3] bg-gradient-to-br from-plum-dark to-plum p-4 sm:p-6 text-cream">
              <div className="absolute inset-0 bg-grid opacity-15" />
              <div className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-lime text-plum-dark shadow-lg">
                <Award className="h-5 w-5"/>
              </div>
              <div className="relative h-full flex flex-col pt-4">
                <div className="text-[10px] uppercase tracking-widest text-lime font-bold">Certificate of Completion</div>
                <div className="mt-8 text-cream/70 text-xs">This is to certify that</div>
                <div className="font-display text-2xl sm:text-3xl font-bold mt-1 text-lime">{name}</div>
                <div className="mt-4 text-cream/80 text-xs leading-relaxed max-w-[85%]">
has successfully completed all requirements, passing all assessments for the program:
                </div>
                <div className="mt-auto pb-2">
                  <div className="font-display text-xl sm:text-2xl font-bold leading-tight">{c.program}</div>
               
                  <div className="flex items-center justify-between mt-4 border-t border-cream/20 pt-3">
                    
                   
                  </div>
                </div>
              </div>
            </div>

            {c.certificateUrl && (
              <div className="border-t border-border bg-slate-50 p-4">
                <a
                  href={c.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full bg-lime text-plum-dark px-4 py-3 text-xs font-semibold shadow-sm border-none w-full"
                >
                  <ExternalLink className="h-3.5 w-3.5" />  View PDF
                
                </a>
              </div>
            )}

            {!c.certificateUrl && (
              <div className="p-4 flex items-center justify-between bg-slate-50 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </div>
                <div className="text-xs text-muted-foreground">No certificate file uploaded yet</div>
              </div>
            )}
          </div>
        ))}

        {inProgress.map(c => {
          const studentInfo = c.students.find(s => s.id === studentId);
          const progress = studentInfo?.progress || 0;
          return (
            <div key={c.id} className="rounded-2xl md:rounded-3xl border-2 border-dashed border-border bg-slate-50 p-6 sm:p-8 flex flex-col justify-center items-center text-center">
              <div className="relative">
                <Award className="h-12 w-12 text-slate-300" />
                <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-slate-500">
                  <Lock className="h-3 w-3" />
                </div>
              </div>
              <div className="mt-4 font-display font-bold text-plum-dark text-base sm:text-lg">{c.program}</div>
              <div className="text-xs text-muted-foreground mt-1 capitalize">{c.name}</div>
              <div className="mt-6 w-full max-w-[220px]">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5 font-mono">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-slate-400 transition-all rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-[10px] mt-3 text-slate-500">
                  Complete all modules and pass all assessments with ≥60% to unlock.
                </div>
              </div>
            </div>
          );
        })}

        {enrolledClassrooms.length === 0 && (
          <div className="col-span-full rounded-2xl md:rounded-3xl border border-border bg-white p-8 sm:p-12 text-center text-slate-500 text-sm">
            You are not enrolled in any programs yet.
          </div>
        )}
      </div>
    </div>
  );
}