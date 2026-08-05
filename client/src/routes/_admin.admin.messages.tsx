import { createFileRoute } from "@tanstack/react-router";
import Chat from "@/components/Chat";

export const Route = createFileRoute("/_admin/admin/messages")({
  component: AdminMessages,
});

function AdminMessages() {
  return <Chat currentUserRole="admin" />;
}