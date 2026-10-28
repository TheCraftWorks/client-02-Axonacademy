import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import {
  LayoutDashboard, BookOpen, PlayCircle, ClipboardList,
  Award, User as UserIcon, Calendar, MessageCircle, School,
} from "lucide-react";
import { PortalShell } from "@/components/portal/PortalShell";
import { classroomActions, useClassroomStore } from "@/lib/classroomStore";
import { getMyClassrooms } from "@/lib/api";

export const StudentLayoutContext = createContext({ isLoadingClassrooms: false });

const NAV = [
  { label: "Dashboard", to: "/student/dashboard", icon: LayoutDashboard },
  { label: "My Classrooms", to: "/student/classrooms", icon: School },
  { label: "My Courses", to: "/student/my-courses", icon: BookOpen },
  { label: "Live Classes", to: "/student/live", icon: PlayCircle },
  { label: "Exams", to: "/student/exams", icon: ClipboardList },
  { label: "Certificates", to: "/student/certificates", icon: Award },
  { label: "Schedule", to: "/student/schedule", icon: Calendar },
  { label: "Messages", to: "/student/messages", icon: MessageCircle },
  { label: "Profile", to: "/student/profile", icon: UserIcon },
];

export const Route = createFileRoute("/_student")({
  component: StudentLayout,
});

function StudentLayout() {
  const { currentUser, classrooms, authReady } = useClassroomStore();
  const [loadError, setLoadError] = useState("");
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    const loadMyClassrooms = async () => {
      if (!currentUser || currentUser.role !== "student") return;
      if (classrooms.length === 0) {
        setIsLoadingClassrooms(true);
      }
      try {
        const cls = await getMyClassrooms();
        if (!active) return;
        classroomActions.setClassrooms(cls);
        setLoadError("");
      } catch (err) {
        if (!active) return;
        if (classrooms.length === 0) {
          setLoadError(err instanceof Error ? err.message : "Could not load your classrooms");
        }
      } finally {
        if (active) setIsLoadingClassrooms(false);
      }
    };

    loadMyClassrooms();
    return () => {
      active = false;
    };
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

  if (!currentUser || currentUser.role !== "student") {
    return <Navigate to="/login" />;
  }

  return (
    <StudentLayoutContext.Provider value={{ isLoadingClassrooms }}>
      <PortalShell
        variant="student"
        brand="Axon Med Academy"
        nav={NAV}
        user={{
          name: currentUser.name,
          role: "Student",
          initials: currentUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
        }}
      >
        {loadError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {loadError}
          </div>
        )}
        <Outlet />
      </PortalShell>
    </StudentLayoutContext.Provider>
  );
}

export function useStudentLayout() {
  return useContext(StudentLayoutContext);
}
