import React, { useState } from "react";
import { DarkCard } from "@/components/portal/PortalShell";
import type { Classroom } from "@/lib/classroomStore";
import { getClassroomJoinRequests, approveClassroomJoinRequest, rejectClassroomJoinRequest } from "@/lib/api";
import { toast } from "sonner";

function JoinRequestsTab({ classroom, refreshClassroom }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom> }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const data = await getClassroomJoinRequests(classroom.id);
      if (data.success) {
        setRequests(data.requests);
      } else {
        toast.error(data.message || "Failed to load requests");
      }
    } catch (err: any) {
      toast.error(err.message || "Error loading join requests");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRequests();
  }, [classroom.id]);

  const handleApprove = async (reqId: string) => {
    setProcessing(reqId);
    try {
      const data = await approveClassroomJoinRequest(classroom.id, reqId);
      if (data.success) {
        await refreshClassroom();
        fetchRequests();
        toast.success("Student approved and enrolled.");
      } else {
        toast.error(data.message || "Failed to approve request");
      }
    } catch (err: any) {
      toast.error(err.message || "Error approving request");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (reqId: string) => {
    setProcessing(reqId);
    try {
      const data = await rejectClassroomJoinRequest(classroom.id, reqId);
      if (data.success) {
        fetchRequests();
        toast.success("Join request rejected.");
      } else {
        toast.error(data.message || "Failed to reject request");
      }
    } catch (err: any) {
      toast.error(err.message || "Error rejecting request");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="text-center py-8 text-cream/50">Loading requests...</div>;

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <DarkCard className="text-center py-10">
          <p className="text-cream/50">No pending join requests.</p>
        </DarkCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map(req => (
            <DarkCard key={req._id}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-cream font-bold">{req.fullName}</h3>
                  <p className="text-cream/60 text-sm">{req.email}</p>
                  <p className="text-cream/60 text-sm">{req.phone}</p>
                </div>
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">Pending</span>
              </div>
              <div className="flex gap-3">
                <button
                  disabled={processing === req._id}
                  onClick={() => handleReject(req._id)}
                  className="flex-1 py-2 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 font-semibold text-sm disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  disabled={processing === req._id}
                  onClick={() => handleApprove(req._id)}
                  className="flex-1 py-2 bg-lime text-plum-dark rounded hover:bg-lime/90 font-bold text-sm disabled:opacity-50"
                >
                  {processing === req._id ? "Approving..." : "Approve"}
                </button>
              </div>
            </DarkCard>
          ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export { JoinRequestsTab };
