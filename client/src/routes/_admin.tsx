import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import {
  LayoutDashboard, BookOpen, Users, GraduationCap, ClipboardList,
  Briefcase, BarChart3, CreditCard, Settings, School, MessageCircle, Award, Video, MessageSquareQuote
} from "lucide-react";
import { PortalShell } from "@/components/portal/PortalShell";
import { useClassroomStore, classroomActions } from "@/lib/classroomStore";
import { getClassrooms } from "@/lib/api";
import { useEffect, useState } from "react";

const ADMIN_NAV = [
  { label: "Overview", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Classrooms", to: "/admin/classrooms", icon: School },
  { label: "Attendance", to: "/admin/classes", icon: School },
  { label: "Courses", to: "/admin/courses", icon: BookOpen },
  { label: "Students", to: "/admin/students", icon: Users },
  // { label: "Faculty", to: "/admin/faculty", icon: GraduationCap },
  { label: "Exams", to: "/admin/exams", icon: ClipboardList },
  // { label: "Placements", to: "/admin/placements", icon: Briefcase },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  // { label: "Finance", to: "/admin/finance", icon: CreditCard },
  { label: "Messages", to: "/admin/messages", icon: MessageCircle },
  { label: "Feedback", to: "/admin/feedback", icon: MessageSquareQuote },
  { label: "Certificates", to: "/admin/certificates", icon: Award },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

const FACULTY_NAV = [
  { label: "Classrooms", to: "/admin/classrooms", icon: School },
  { label: "Attendance", to: "/admin/classes", icon: School },
  { label: "Students", to: "/admin/students", icon: Users },
  { label: "Exams", to: "/admin/exams", icon: ClipboardList },
  { label: "Messages", to: "/admin/messages", icon: MessageCircle },
];

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { currentUser, authReady, classrooms } = useClassroomStore();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== "student" && classrooms.length === 0) {
      getClassrooms()
        .then((cls) => classroomActions.setClassrooms(cls))
        .catch(() => {});
    }
  }, [currentUser?.id, currentUser?.role]);

  // Show a minimal skeleton while SSR hydration completes or auth is rehydrating — avoids blank flash and false redirect
  if (!hasMounted || !authReady) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--background, #faf9f7)' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#4c1d95', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!currentUser || currentUser.role === "student") {
    return <Navigate to="/login" />;
  }

  const navItems = currentUser.role === "faculty" ? FACULTY_NAV : ADMIN_NAV;

  return (
    <PortalShell
      variant="admin"
      brand="Axon Med Academy"
      nav={navItems}
      user={{
        name: currentUser.name,
        role: currentUser.role === "faculty" ? "Faculty" : "Admin",
        initials: currentUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
      }}
    >
      <Outlet />
    </PortalShell>
  );
}
