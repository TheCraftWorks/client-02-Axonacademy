import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_student/student/webex/$roomId")({
  component: RedirectToLive,
});

function RedirectToLive() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/live/$roomId", params: { roomId } });
  }, [roomId, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-plum border-t-transparent mx-auto"></div>
        <p>Connecting to Live Class...</p>
      </div>
    </div>
  );
}
