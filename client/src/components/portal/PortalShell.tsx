import * as React from "react";
import { useLocation, Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut } from "lucide-react";
import { classroomStore } from "@/lib/classroomStore";
import { logoutUser } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface User {
  name: string;
  role: string;
  initials: string;
}

interface PortalShellProps {
  variant: "admin" | "student";
  brand: string;
  nav: NavItem[];
  user: User;
  children: React.ReactNode;
}

// ─── PortalShell ─────────────────────────────────────────────────────────────

export function PortalShell({ variant, brand, nav, user, children }: PortalShellProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const isAdmin = variant === "admin";
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      classroomStore.setState(() => ({ currentUser: null, accessToken: null }));
      navigate({ to: "/" });
    }
  };

  // Tailwind classes based on variant
  // Both Student and Admin shells use Axon Med Academy Navy/Gold palette
  const shellClass = "bg-[#F0F4F8] text-slate-900";
  const sidebarClass = "bg-[#0B1F3A] border-white/10";
  const linkBaseClass = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/10 text-white/70";
  const linkActiveClass = "bg-[#F4B400]/15 !text-[#F4B400] font-medium";
  const brandColorClass = "text-[#F4B400]";
  const initialsBgClass = "bg-[#F4B400]/20 text-[#F4B400]";

  // Shared Sidebar Content
  const SidebarContent = () => (
    <>
      <div className={`h-16 flex items-center justify-between px-6 border-b border-white/10 font-display font-bold text-lg tracking-tight ${brandColorClass} shrink-0`}>
        {brand}
        <button className="md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const isActive = currentPath === item.to || (item.to !== "/" && currentPath.startsWith(item.to + "/"));
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={`${linkBaseClass} ${isActive ? linkActiveClass : ""}`}
            >
              <item.icon className="w-4.5 h-4.5 opacity-75 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="my-2 h-px bg-white/10" />

        {/* Sign Out button — always visible in nav */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-red-500 hover:bg-red-500/10`}
        >
          <LogOut className="w-4.5 h-4.5 shrink-0" />
          Sign Out
        </button>
      </nav>

      <div className="p-4 border-t border-white/10 flex items-center gap-3 shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${initialsBgClass}`}>
          {user.initials}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[13px] truncate text-white">{user.name}</div>
          <div className="text-[11px] truncate text-white/60">{user.role}</div>
        </div>
      </div>
    </>
  );

  return (
    <div className={`flex min-h-screen w-full font-sans ${shellClass} ${isAdmin ? "admin-portal" : ""}`}>
      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col w-64 shrink-0 border-r ${sidebarClass} sticky top-0 h-screen overflow-hidden`}>
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ───────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className={`relative flex flex-col w-[280px] max-w-[80%] h-full shadow-2xl ${sidebarClass}`}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden">
        {/* Mobile Header */}
        <div className={`md:hidden flex items-center justify-between h-16 px-4 border-b sticky top-0 z-40 bg-[#0B1F3A] border-white/10`}>
          <div className={`font-display font-bold text-lg ${brandColorClass}`}>{brand}</div>
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -mr-2">
            <Menu className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Card components ──────────────────────────────────────────────────────────

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl sm:rounded-3xl border border-border bg-card text-card-foreground p-5 sm:p-6 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function DarkCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl sm:rounded-2xl border border-white/10 bg-[#1A0F33] text-cream p-5 sm:p-6 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string | number;
  delta?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "plum" | "lime" | "navy" | "gold" | "sky" | "emerald";
}

export function StatTile({ label, value, delta, icon: Icon, accent = "plum" }: StatTileProps) {
  const iconBgMap: Record<string, string> = {
    lime: "bg-lime/10 text-lime",
    plum: "bg-plum/10 text-plum",
    navy: "",
    gold: "",
    sky: "",
    emerald: "",
  };
  const iconStyleMap: Record<string, React.CSSProperties> = {
    navy: { background: 'rgba(11,31,58,0.1)', color: '#0B1F3A' },
    gold: { background: 'rgba(244,180,0,0.12)', color: '#B8870A' },
    sky:  { background: 'rgba(45,156,219,0.12)', color: '#2D9CDB' },
    emerald: { background: 'rgba(22,163,74,0.12)', color: '#16A34A' },
    plum: {},
    lime: {},
  };
  const iconBg = iconBgMap[accent] ?? "bg-plum/10 text-plum";
  const iconStyle = iconStyleMap[accent] ?? {};

  return (
    <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground truncate">
          {label}
        </div>
        {Icon && (
          <div className={`grid h-7 w-7 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-lg ${iconBg}`} style={iconStyle}>
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
        )}
      </div>
      <div className="mt-2 sm:mt-3 font-display text-2xl sm:text-3xl font-bold truncate">{value}</div>
      {delta && (
        <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">{delta}</div>
      )}
    </div>
  );
}
