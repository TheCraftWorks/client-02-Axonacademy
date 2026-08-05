import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, BookOpen, PlayCircle, ClipboardList,
  Award, User as UserIcon, Calendar, MessageCircle, School,
} from "lucide-react";
import { PortalShell } from "@/components/portal/PortalShell";
import { classroomActions, useClassroomStore } from "@/lib/classroomStore";
import { getMyClassrooms } from "@/lib/api";

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
  const { currentUser } = useClassroomStore();
  const [loadError, setLoadError] = useState("");
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    const loadMyClassrooms = async () => {
      if (!currentUser || currentUser.role !== "student") return;
      try {
        const classrooms = await getMyClassrooms();
        if (!active) return;
        classroomActions.setClassrooms(classrooms);
        setLoadError("");
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : "Could not load your classrooms");
      }
    };

    loadMyClassrooms();
    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUser?.role]);

  if (!hasMounted) {
    return null;
  }

  if (!currentUser || currentUser.role !== "student") {
    return <Navigate to="/login" />;
  }

  return (
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
  );
}
