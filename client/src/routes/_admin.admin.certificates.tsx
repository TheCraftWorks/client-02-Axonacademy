import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { LuAward, LuUpload, LuLink, LuX, LuCheck, LuSearch, LuArrowLeft } from "react-icons/lu";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore, classroomActions } from "@/lib/classroomStore";
import { getClassrooms, updateStudentCertificate, getAdminUsers } from "@/lib/api";

export const Route = createFileRoute("/_admin/admin/certificates")({
  component: AdminCertificates,
});

function AdminCertificates() {
  const { currentUser } = useClassroomStore();
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [certLink, setCertLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [mongoUsers, setMongoUsers] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [classroomsData, users] = await Promise.all([
          getClassrooms(),
          getAdminUsers("student"),
        ]);
        if (!active) return;
        setClassrooms(classroomsData);
        setMongoUsers(users);
        setLoading(false);
      } catch (err) {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const handleSelectClass = (cls: any) => {
    setSelectedClass(cls);
    setSelectedStudentId(null);
    setCertLink("");
    setSaved(false);
    setError("");
  };

  const handleSelectStudent = (studentId: string, currentLink?: string) => {
    setSelectedStudentId(studentId);
    setCertLink(currentLink || "");
    setSaved(false);
    setError("");
  };

  const handleSave = async () => {
    if (!selectedClass || !selectedStudentId) return;
    setError("");
    setSaving(true);
    setSaved(false);
    try {
      await updateStudentCertificate(selectedClass.id, selectedStudentId, certLink.trim() || "");
      const updatedClass = {
        ...selectedClass,
        students: selectedClass.students.map((s: any) =>
          s.id === selectedStudentId ? { ...s, certificateUrl: certLink.trim() || undefined } : s
        ),
      };
      setSelectedClass(updatedClass);
      classroomActions.updateClassroom(selectedClass.id, updatedClass);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setSelectedStudentId(null);
      setCertLink("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save certificate");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    if (!selectedClass) return;
    setError("");
    setSaving(true);
    try {
      await updateStudentCertificate(selectedClass.id, studentId, "");
      const updatedClass = {
        ...selectedClass,
        students: selectedClass.students.map((s: any) =>
          s.id === studentId ? { ...s, certificateUrl: undefined } : s
        ),
      };
      setSelectedClass(updatedClass);
      classroomActions.updateClassroom(selectedClass.id, updatedClass);
      if (selectedStudentId === studentId) {
        setSelectedStudentId(null);
        setCertLink("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove certificate");
    } finally {
      setSaving(false);
    }
  };

  const getClassStudents = () => {
    if (!selectedClass) return [];
    const enrolled = selectedClass.students || [];
    return enrolled.map((s: any) => {
      const mongoUser = mongoUsers.find(u => u.id === s.id);
      return {
        ...s,
        email: s.email || mongoUser?.email || "",
        phone: s.phone || mongoUser?.phone || "",
      };
    });
  };

  const classStudents = getClassStudents();
  const filteredStudents = searchQuery
    ? classStudents.filter((s: any) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : classStudents;

  const activeCount = classStudents.filter((s: any) => s.status === "active").length;
  const certCount = classStudents.filter((s: any) => s.certificateUrl).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold text-cream">Certificates</h1>
          <p className="text-sm text-cream/60 mt-1">Upload and manage certificates per student per classroom</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!selectedClass ? (
        <div>
          {loading ? (
            <DarkCard className="text-center py-12">
              <p className="text-cream/60 text-sm">Loading classrooms…</p>
            </DarkCard>
          ) : classrooms.length === 0 ? (
            <DarkCard className="text-center py-12">
              <LuAward className="h-10 w-10 text-cream/20 mx-auto mb-3" />
              <p className="text-cream/60 text-sm">No classrooms found. Create a classroom first.</p>
            </DarkCard>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classrooms.map((cls: any) => {
                const activeStudentCount = cls.students?.filter((s: any) => s.status === "active").length || 0;
                const certStudentCount = cls.students?.filter((s: any) => s.certificateUrl).length || 0;

                return (
                  <button
                    key={cls.id}
                    onClick={() => handleSelectClass(cls)}
                    className="rounded-2xl border border-cream/10 bg-[#1A0F33] p-5 text-left hover:shadow-lg hover:border-lime/30 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-display font-bold text-cream group-hover:text-lime transition-colors">{cls.name}</h3>
                        <p className="text-xs text-cream/50 font-mono mt-0.5">{cls.code}</p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full ${cls.status === "active" ? "bg-lime/20 text-lime" : "bg-cream/10 text-cream/60"}`}>
                        {cls.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-cream/60 mb-3">
                      <span>{activeStudentCount} active</span>
                      <span>·</span>
                      <span className="text-lime font-semibold">{certStudentCount} certified</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-cream/50">{cls.program || "No program"}</span>
                      <LuAward className="h-4 w-4 text-lime/60 group-hover:text-lime transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedClass(null); setSelectedStudentId(null); setCertLink(""); }}
              className="flex items-center gap-1 text-sm text-cream/60 hover:text-cream transition-colors"
            >
              <LuArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="h-4 w-px bg-cream/10" />
            <div className="flex-1">
              <h2 className="font-display font-bold text-cream">{selectedClass.name}</h2>
              <p className="text-xs text-cream/50 font-mono">{selectedClass.code} · {selectedClass.program}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-cream/60">
              <span>{activeCount} active</span>
              <span className="text-lime font-semibold">{certCount} certified</span>
            </div>
          </div>

          <div className="relative">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students…"
              className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-cream outline-none focus:border-lime/50"
            />
          </div>

          {filteredStudents.length === 0 ? (
            <DarkCard className="text-center py-12">
              <p className="text-cream/60 text-sm">No students in this classroom.</p>
            </DarkCard>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student: any) => {
                const isSelected = selectedStudentId === student.id;
                const hasCert = !!student.certificateUrl;

                return (
                  <div
                    key={student.id}
                    className={`rounded-2xl border bg-[#1A0F33] p-4 transition-all ${
                      isSelected
                        ? "border-lime shadow-md"
                        : hasCert
                          ? "border-lime/30"
                          : "border-cream/10 hover:border-lime/20"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold shrink-0 ${
                        hasCert ? "bg-lime text-plum-dark" : "bg-cream/10 text-cream/60"
                      }`}>
                        {student.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-cream text-sm">{student.name}</span>
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                            student.status === "active"
                              ? "bg-lime/20 text-lime"
                              : student.status === "held"
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-red-500/20 text-red-300"
                          }`}>
                            {student.status}
                          </span>
                          {hasCert && (
                            <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-lime/20 text-lime flex items-center gap-1">
                              <LuCheck className="h-3 w-3" /> Certified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-cream/60 mt-0.5">{student.email}</p>
                        {student.certificateUrl && (
                          <a
                            href={student.certificateUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-lime hover:text-lime/80 mt-1"
                          >
                            <LuLink className="h-3 w-3" /> View certificate
                          </a>
                        )}
                      </div>

                      <div className="shrink-0">
                        {!isSelected ? (
                          <button
                            onClick={() => handleSelectStudent(student.id, student.certificateUrl)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                              hasCert
                                ? "bg-lime/10 text-lime hover:bg-lime/20"
                                : "bg-cream/10 text-cream/70 hover:bg-cream/20"
                            }`}
                          >
                            <LuUpload className="h-3 w-3" />
                            {hasCert ? "Update" : "Upload"} Certificate
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-cream/10">
                        <div className="text-xs text-cream/60 mb-2">Certificate Link</div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <input
                              type="url"
                              value={certLink}
                              onChange={(e) => setCertLink(e.target.value)}
                              placeholder="Paste Google Drive certificate link (set sharing to 'Anyone with link can view')"
                              className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                            />
                          </div>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold disabled:opacity-50"
                          >
                            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Certificate"}
                          </button>
                          {hasCert && (
                            <button
                              onClick={() => handleRemove(student.id)}
                              disabled={saving}
                              className="text-cream/30 hover:text-red-400 transition-colors"
                              title="Remove certificate"
                            >
                              <LuX className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => { setSelectedStudentId(null); setCertLink(""); setError(""); }}
                            className="text-cream/40 hover:text-red-400"
                          >
                            <LuX className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}