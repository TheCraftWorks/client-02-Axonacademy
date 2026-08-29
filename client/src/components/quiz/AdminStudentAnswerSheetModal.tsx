import React, { useState } from "react";
import { X, Trophy, Clock, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { QuizQuestionReviewTabs, type ReviewQuestionItem, type FilterTab } from "./QuizQuestionReviewTabs";

interface AdminStudentAnswerSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentEmail?: string;
  quizTitle: string;
  rank?: number;
  score: {
    rawMarks: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
  };
  totalTimeTakenSec?: number;
  submittedAt?: string;
  answers: ReviewQuestionItem[];
}

export function AdminStudentAnswerSheetModal({
  isOpen,
  onClose,
  studentName,
  studentEmail,
  quizTitle,
  rank,
  score,
  totalTimeTakenSec = 0,
  submittedAt,
  answers = [],
}: AdminStudentAnswerSheetModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const totalQuestions = answers.length;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const wrongCount = answers.filter((a) => a.isAttempted && !a.isCorrect).length;
  const unattemptedCount = answers.filter((a) => !a.isAttempted).length;

  const formatSec = (sec: number) => {
    if (!sec || sec <= 0) return "< 1 min";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900">
        {/* Fixed Modal Header + Integrated 4 Tabs */}
        <div className="border-b border-slate-200 bg-slate-50 shrink-0">
          {/* Top Bar: Student Info, Badges, Score, Time & Close button */}
          <div className="p-4 sm:p-5 pb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-800 font-bold text-base uppercase font-display shrink-0">
                {studentName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 truncate">{studentName}</h3>
                  {rank && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-600" /> Rank #{rank}
                    </span>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                    score.passed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {score.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap font-medium">
                  <span className="truncate max-w-[200px] sm:max-w-xs">{quizTitle} {studentEmail ? `· ${studentEmail}` : ""}</span>
                  <span>•</span>
                  <span className="font-mono text-slate-800 font-bold">Score: {score.rawMarks}/{score.totalMarks} Marks ({score.percentage}%)</span>
                  <span>•</span>
                  <span className="text-slate-700 font-semibold">{correctCount + wrongCount}/{totalQuestions} Attended</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-700 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" /> {formatSec(totalTimeTakenSec)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Tabs directly inside Header container (Non-floating) */}
          <div className="px-4 sm:px-5 pb-3">
            <div className="p-1 rounded-xl bg-slate-200/60 border border-slate-200 flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`flex-1 min-w-[110px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "all"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:bg-white/60"
                }`}
              >
                <span>All Questions</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "all" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {totalQuestions}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("correct")}
                className={`flex-1 min-w-[110px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "correct"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Correct</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "correct" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                }`}>
                  {correctCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("wrong")}
                className={`flex-1 min-w-[110px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "wrong"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-rose-700 hover:bg-rose-50"
                }`}
              >
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Wrong</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "wrong" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"
                }`}>
                  {wrongCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("unattempted")}
                className={`flex-1 min-w-[110px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "unattempted"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-amber-800 hover:bg-amber-50"
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Not Attempted</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "unattempted" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
                }`}>
                  {unattemptedCount}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Questions Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-white space-y-3.5">
          <QuizQuestionReviewTabs
            answers={answers}
            theme="light"
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hideTabBar={true}
          />
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-slate-200"
          >
            Close Sheet
          </button>
        </div>
      </div>
    </div>
  );
}
