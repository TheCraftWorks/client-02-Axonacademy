import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useClassroomStore } from "@/lib/classroomStore";

export const Route = createFileRoute("/live/")({
  component: LiveRedirect,
});

function LiveRedirect() {
  const { currentUser } = useClassroomStore();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role === "student") {
    return <Navigate to="/student/live" replace />;
  }

  return <Navigate to="/admin/dashboard" replace />;
}
