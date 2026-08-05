import { createFileRoute } from "@tanstack/react-router";
import { IndianRupee, TrendingUp, Clock, AlertTriangle, ChevronDown } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore, adminActions, type PaymentStatus } from "@/lib/classroomStore";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_admin/admin/finance")({
  component: Finance,
});

function Finance() {
  const { classrooms, courses, payments } = useClassroomStore();
  const [courseFilter, setCourseFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const transactions = useMemo(() => {
    const txs: {
      id: string; studentId: string; studentName: string; email: string;
      course: string; classroomId: string; amount: number; date: string; status: PaymentStatus;
    }[] = [];
    classrooms.forEach(c => {
      const course = courses.find(x => x.title === c.program);
      const price = course?.price || 15000;
      c.students.forEach(s => {
        const paymentRecord = payments.find(p => p.studentId === s.id && p.classroomId === c.id);
        const status: PaymentStatus = paymentRecord
          ? paymentRecord.status
          : s.status === "active" ? "Paid" : s.status === "held" ? "Pending" : "Overdue";
        txs.push({
          id: `${s.id}-${c.id}`,
          studentId: s.id,
          studentName: s.name,
          email: s.email,
          course: c.program,
          classroomId: c.id,
          amount: price,
          date: new Date(s.addedAt).toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" }),
          status,
        });
      });
    });
    return txs.reverse();
  }, [classrooms, courses, payments]);

  const filtered = transactions.filter(t => {
    if (courseFilter !== "All" && t.course !== courseFilter) return false;
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    return true;
  });

  const totalRevenue = transactions.reduce((s, t) => s + t.amount, 0);
  const collected = transactions.filter(t => t.status === "Paid").reduce((s, t) => s + t.amount, 0);
  const pending = transactions.filter(t => t.status === "Pending").reduce((s, t) => s + t.amount, 0);
  const overdue = transactions.filter(t => t.status === "Overdue").reduce((s, t) => s + t.amount, 0);
  const overdueCount = transactions.filter(t => t.status === "Overdue").length;

  const fmt = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString("en-IN")}`;

  // Per-course revenue
  const courseRevenue = courses.map(c => {
    const enrolled = classrooms.filter(cls => cls.program === c.title).flatMap(cls => cls.students.filter(s => s.status === "active"));
    const rev = enrolled.length * c.price;
    return { title: c.title, enrolled: enrolled.length, price: c.price, rev };
  }).filter(c => c.enrolled > 0).sort((a, b) => b.rev - a.rev);
  const maxCourseRev = Math.max(...courseRevenue.map(c => c.rev), 1);

  // Monthly sparkline (last 6 months)
  const monthlyData: Record<string, number> = {};
  transactions.forEach(t => {
    const key = t.date.split(" ").slice(0, 2).join(" ");
    if (!monthlyData[key]) monthlyData[key] = 0;
    if (t.status === "Paid") monthlyData[key] += t.amount;
  });
  const monthKeys = Object.keys(monthlyData).slice(-6);
  const maxMonth = Math.max(...monthKeys.map(k => monthlyData[k]), 1);

  const handleStatusChange = (studentId: string, classroomId: string, status: PaymentStatus) => {
    adminActions.updatePaymentStatus(studentId, classroomId, status);
  };

  const statusColor = (s: PaymentStatus) =>
    s === "Paid" ? "bg-lime/20 text-lime" : s === "Pending" ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300";

  return (
    <div className="space-y-6 text-cream">
      <div>
        <h1 className="font-display text-3xl font-bold">Finance</h1>
        <p className="text-cream/60 text-sm mt-1">Revenue, fees, and payment status tracking across cohorts</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: "Total Revenue", v: fmt(totalRevenue), d: "All enrollments", i: IndianRupee },
          { l: "Collected", v: fmt(collected), d: `${totalRevenue ? Math.round((collected / totalRevenue) * 100) : 0}% of total`, i: TrendingUp },
          { l: "Pending", v: fmt(pending), d: `${transactions.filter(t => t.status === "Pending").length} invoices`, i: Clock },
          { l: "Overdue", v: fmt(overdue), d: `${overdueCount} students`, i: AlertTriangle, warn: true },
        ].map(s => (
          <div key={s.l} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-cream/60">{s.l}</div>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-lime/15 text-lime"><s.i className="h-4 w-4" /></div>
            </div>
            <div className={`font-display text-2xl font-bold mt-3 ${s.warn && overdueCount > 0 ? "text-red-400" : ""}`}>{s.v}</div>
            <div className="text-xs text-cream/60 mt-1">{s.d}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Course Revenue Chart */}
        <DarkCard>
          <h3 className="font-display font-bold text-lg mb-4">Revenue by Course</h3>
          <div className="space-y-3">
            {courseRevenue.map(c => (
              <div key={c.title}>
                <div className="flex justify-between text-sm mb-1">
                  <div>
                    <div className="font-semibold text-xs text-cream">{c.title}</div>
                    <div className="text-[10px] text-cream/50">{c.enrolled} enrolled · ₹{c.price.toLocaleString("en-IN")}/student</div>
                  </div>
                  <span className="font-mono text-lime text-sm font-bold">{fmt(c.rev)}</span>
                </div>
                <div className="h-2 rounded-full bg-cream/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-lime/60 to-lime rounded-full" style={{ width: `${(c.rev / maxCourseRev) * 100}%` }} />
                </div>
              </div>
            ))}
            {courseRevenue.length === 0 && <p className="text-cream/50 text-sm">No enrollment data yet.</p>}
          </div>
        </DarkCard>

        {/* Collection Sparkline */}
        <DarkCard>
          <h3 className="font-display font-bold text-lg mb-4">Collection Trend</h3>
          {monthKeys.length > 0 ? (
            <>
              <div className="flex items-end gap-2 h-32">
                {monthKeys.map(m => (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-lime/60 hover:bg-lime transition-colors"
                      style={{ height: `${(monthlyData[m] / maxMonth) * 100}%`, minHeight: "4px" }} />
                    <span className="text-[8px] text-cream/50 truncate w-full text-center">{m.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="text-center rounded-lg bg-lime/10 p-2">
                  <div className="text-[10px] text-cream/60">Paid</div>
                  <div className="font-mono text-sm font-bold text-lime">{transactions.filter(t => t.status === "Paid").length}</div>
                </div>
                <div className="text-center rounded-lg bg-amber-500/10 p-2">
                  <div className="text-[10px] text-cream/60">Pending</div>
                  <div className="font-mono text-sm font-bold text-amber-300">{transactions.filter(t => t.status === "Pending").length}</div>
                </div>
                <div className="text-center rounded-lg bg-red-500/10 p-2">
                  <div className="text-[10px] text-cream/60">Overdue</div>
                  <div className="font-mono text-sm font-bold text-red-400">{overdueCount}</div>
                </div>
              </div>
            </>
          ) : <p className="text-cream/50 text-sm">No payment data yet.</p>}
        </DarkCard>
      </div>

      {/* Transactions Table */}
      <DarkCard className="p-0 overflow-hidden">
        <div className="p-5 border-b border-cream/10 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-bold">Fee Transactions</h3>
          <div className="flex gap-2">
            <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="bg-cream/5 border border-cream/10 rounded-full px-3 py-1.5 text-sm text-cream outline-none">
              <option value="All">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-cream/5 border border-cream/10 rounded-full px-3 py-1.5 text-sm text-cream outline-none">
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/5">
              <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                <th className="p-4">Student</th><th>Course</th><th>Amount</th><th>Date</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-cream/50">No transactions found.</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-cream/10 hover:bg-cream/5">
                  <td className="p-4">
                    <div className="font-semibold">{r.studentName}</div>
                    <div className="text-[11px] text-cream/50">{r.email}</div>
                  </td>
                  <td className="text-cream/70">{r.course}</td>
                  <td className="font-mono text-lime">₹{r.amount.toLocaleString("en-IN")}</td>
                  <td className="text-cream/60 text-xs">{r.date}</td>
                  <td>
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${statusColor(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="pr-4">
                    <select
                      value={r.status}
                      onChange={e => handleStatusChange(r.studentId, r.classroomId, e.target.value as PaymentStatus)}
                      className="bg-cream/5 border border-cream/10 rounded-lg px-2 py-1 text-cream/70 text-xs outline-none"
                    >
                      <option value="Paid">Mark Paid</option>
                      <option value="Pending">Mark Pending</option>
                      <option value="Overdue">Mark Overdue</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DarkCard>
    </div>
  );
}
