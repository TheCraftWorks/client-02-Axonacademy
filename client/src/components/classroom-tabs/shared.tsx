// ─── Shared helpers, types, and UI atoms used by all admin classroom tab files ─

import React from "react";
import { LuClock, LuCheck, LuX, LuRadio } from "react-icons/lu";
import type { IconType } from "react-icons";
import type { Meeting } from "@/lib/classroomStore";

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export function toDatetimeLocal(isoString?: string) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return "";
  }
}

export function toISODateString(localDateStr?: string) {
  if (!localDateStr) return null;
  try {
    const d = new Date(localDateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function timeAgo(iso?: string) {
  if (!iso) return "recently";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "recently";
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

export function MeetingStatusBadge({ status }: { status: Meeting["status"] }) {
  const map: Record<Meeting["status"], { cls: string; icon: IconType; label: string }> = {
    live: { cls: "bg-red-500/20 text-red-300", icon: LuRadio, label: "LIVE" },
    scheduled: { cls: "bg-lime/20 text-lime", icon: LuClock, label: "Scheduled" },
    ended: { cls: "bg-cream/10 text-cream/60", icon: LuCheck, label: "Done" },
    cancelled: { cls: "bg-red-900/30 text-red-400", icon: LuX, label: "Cancelled" },
  };
  const { cls, icon: Icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${cls}`}>
      <Icon className={`h-3 w-3 ${status === "live" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

export function DarkSkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-cream/5 border border-cream/10 ${className}`} />
  );
}

export function DarkTabSkeletonLoader({ type = "rows" }: { type?: "rows" | "grid" | "cards" }) {
  return (
    <div className="space-y-3">
      {type === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <DarkSkeletonCard className="h-24 w-full" />
          <DarkSkeletonCard className="h-24 w-full" />
          <DarkSkeletonCard className="h-24 w-full" />
        </div>
      ) : (
        <>
          <DarkSkeletonCard className="h-20 w-full" />
          <DarkSkeletonCard className="h-20 w-full" />
          <DarkSkeletonCard className="h-20 w-full" />
        </>
      )}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-slate-200/70 border border-slate-100 ${className}`} />
  );
}

export function TabSkeletonLoader({ type = "cards" }: { type?: "cards" | "grid" | "rows" }) {
  return (
    <div className="space-y-3">
      {type === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <SkeletonCard className="h-24 w-full" />
          <SkeletonCard className="h-24 w-full" />
          <SkeletonCard className="h-24 w-full" />
        </div>
      ) : (
        <>
          <SkeletonCard className="h-20 w-full" />
          <SkeletonCard className="h-20 w-full" />
          <SkeletonCard className="h-20 w-full" />
        </>
      )}
    </div>
  );
}

