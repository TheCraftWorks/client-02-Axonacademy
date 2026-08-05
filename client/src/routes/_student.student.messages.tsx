import { createFileRoute } from "@tanstack/react-router";
import Chat from "@/components/Chat";

export const Route = createFileRoute("/_student/student/messages")({
  component: StudentMessages,
});

function StudentMessages() {
  return <Chat currentUserRole="student" />;
}
