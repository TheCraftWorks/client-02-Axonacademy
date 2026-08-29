import React, { useState } from "react";
import {
  CheckCircle2, XCircle, HelpCircle,
  BookOpen
} from "lucide-react";

export interface ReviewQuestionItem {
  questionId: string;
  questionText: string;
  marks?: number;
  selectedOptions: string[];
  correctOptions: string[];
  isAttempted?: boolean;
  isCorrect: boolean;
  marksAwarded: number;
  timeTakenSec?: number;
  explanation?: string;
  options?: Array<{
    label: string;
    text: string;
    isCorrect?: boolean;
  }>;
}

export type FilterTab = "all" | "correct" | "wrong" | "unattempted";

interface QuizQuestionReviewTabsProps {
  answers: ReviewQuestionItem[];
  theme?: "dark" | "light";
  className?: string;
  activeTab?: FilterTab;
  onTabChange?: (tab: FilterTab) => void;
  hideTabBar?: boolean;
}

export function QuizQuestionReviewTabs({
  answers,
  theme = "light",
  className = "",
  activeTab: controlledTab,
  onTabChange,
  hideTabBar = false,
}: QuizQuestionReviewTabsProps) {
  const [internalTab, setInternalTab] = useState<FilterTab>("all");
  const isControlled = controlledTab !== undefined;
  const currentTab = isControlled ? controlledTab : internalTab;

  const handleTabChange = (tab: FilterTab) => {
    if (!isControlled) {
      setInternalTab(tab);
    }
    onTabChange?.(tab);
  };

  const isDark = theme === "dark";

  const totalQuestions = answers.length;
  const correctQuestions = answers.filter((a) => a.isCorrect);
  const wrongQuestions = answers.filter((a) => a.isAttempted && !a.isCorrect);
  const unattemptedQuestions = answers.filter((a) => !a.isAttempted);

  const displayedQuestions =
    currentTab === "correct"
      ? correctQuestions
      : currentTab === "wrong"
      ? wrongQuestions
      : currentTab === "unattempted"
      ? unattemptedQuestions
      : answers;

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* 4 Tabs Bar (rendered when not hidden) */}
      {!hideTabBar && (
        <div className={`p-1 rounded-xl border flex flex-wrap items-center gap-1 ${
          isDark
            ? "bg-[#181030] border-white/15"
            : "bg-slate-100 border-slate-200"
        }`}>
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`flex-1 min-w-[110px] py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              currentTab === "all"
                ? isDark
                  ? "bg-white text-slate-950 shadow-xs"
                  : "bg-white text-slate-900 shadow-xs border border-slate-200"
                : isDark
                ? "text-slate-300 hover:bg-white/10"
                : "text-slate-600 hover:bg-white/60"
            }`}
          >
            <span>All Questions</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              currentTab === "all"
                ? isDark ? "bg-slate-900 text-white" : "bg-slate-900 text-white"
                : isDark ? "bg-white/10 text-slate-300" : "bg-slate-200 text-slate-700"
            }`}>
              {totalQuestions}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("correct")}
            className={`flex-1 min-w-[110px] py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              currentTab === "correct"
                ? "bg-emerald-600 text-white shadow-xs"
                : isDark
                ? "text-emerald-400 hover:bg-emerald-500/10"
                : "text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Correct</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              currentTab === "correct"
                ? "bg-white/20 text-white"
                : isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-800"
            }`}>
              {correctQuestions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("wrong")}
            className={`flex-1 min-w-[110px] py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              currentTab === "wrong"
                ? "bg-rose-600 text-white shadow-xs"
                : isDark
                ? "text-rose-400 hover:bg-rose-500/10"
                : "text-rose-700 hover:bg-rose-50"
            }`}
          >
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Wrong</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              currentTab === "wrong"
                ? "bg-white/20 text-white"
                : isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-800"
            }`}>
              {wrongQuestions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("unattempted")}
            className={`flex-1 min-w-[110px] py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              currentTab === "unattempted"
                ? isDark ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "bg-amber-500 text-white shadow-xs font-black"
                : isDark
                ? "text-amber-400 hover:bg-amber-500/10 font-bold"
                : "text-amber-800 hover:bg-amber-50 font-bold"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Not Attempted</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              currentTab === "unattempted"
                ? isDark ? "bg-slate-950 text-amber-300" : "bg-white/20 text-white"
                : isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-900"
            }`}>
              {unattemptedQuestions.length}
            </span>
          </button>
        </div>
      )}

      {/* List of Questions */}
      <div className="space-y-3">
        {displayedQuestions.map((q, displayIdx) => {
          const originalIdx = answers.findIndex((a) => a.questionId === q.questionId);
          const questionNo = originalIdx >= 0 ? originalIdx + 1 : displayIdx + 1;

          const selectedLabels = q.selectedOptions || [];
          const correctLabels = q.correctOptions || [];
          const isAttempted = q.isAttempted;
          const isCorrect = q.isCorrect;
          const isWrong = isAttempted && !isCorrect;

          const cardStyle = isDark
            ? "border-white/10 bg-[#160D2E]"
            : "border-slate-200 bg-white shadow-xs";

          return (
            <div
              key={q.questionId || displayIdx}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${cardStyle}`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                      isCorrect
                        ? "bg-emerald-100 text-emerald-800"
                        : isWrong
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {questionNo}
                  </span>
                  <div>
                    <p className={`text-sm font-bold leading-relaxed ${isDark ? "text-white" : "text-slate-900"}`}>
                      {q.questionText}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                      isCorrect
                        ? isDark
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isWrong
                        ? isDark
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                        : isDark
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {isCorrect ? "✓ Correct" : isWrong ? "✗ Wrong" : "⊘ Not Attempted"}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${
                    q.marksAwarded > 0
                      ? isDark ? "text-emerald-400" : "text-emerald-700"
                      : q.marksAwarded < 0
                      ? isDark ? "text-rose-400" : "text-rose-700"
                      : isDark ? "text-slate-400" : "text-slate-500"
                  }`}>
                    {q.marksAwarded > 0 ? `+${q.marksAwarded} marks` : `${q.marksAwarded} marks`}
                  </span>
                </div>
              </div>

              {/* Options Breakdown */}
              {q.options && q.options.length > 0 && (
                <div className="space-y-2 mb-3 pl-8">
                  {q.options.map((opt) => {
                    const isSelected = selectedLabels.includes(opt.label);
                    const isCorrectOpt = correctLabels.includes(opt.label) || !!opt.isCorrect;

                    let optStyle = isDark
                      ? "border-white/10 bg-white/5 text-slate-200"
                      : "border-slate-200 bg-slate-50/60 text-slate-700";
                    let circleStyle = isDark
                      ? "border-white/20 bg-white/10 text-white font-bold"
                      : "border-slate-200 bg-white text-slate-700 font-bold";
                    let badge: React.ReactNode = null;

                    if (isCorrectOpt && isSelected) {
                      optStyle = isDark
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200 font-semibold"
                        : "border-emerald-300 bg-emerald-50 text-emerald-950 font-semibold";
                      circleStyle = "bg-emerald-600 text-white border-emerald-600 font-bold";
                      badge = (
                        <span className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${
                          isDark
                            ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
                            : "text-emerald-800 bg-emerald-100 border-emerald-200"
                        }`}>
                          ✓ Your Choice (Correct)
                        </span>
                      );
                    } else if (isSelected && !isCorrectOpt) {
                      optStyle = isDark
                        ? "border-rose-500/60 bg-rose-500/15 text-rose-200 font-semibold"
                        : "border-rose-300 bg-rose-50 text-rose-950 font-semibold";
                      circleStyle = "bg-rose-600 text-white border-rose-600 font-bold";
                      badge = (
                        <span className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${
                          isDark
                            ? "text-rose-300 bg-rose-500/20 border-rose-500/30"
                            : "text-rose-800 bg-rose-100 border-rose-200"
                        }`}>
                          ✗ Your Choice (Wrong)
                        </span>
                      );
                    } else if (isCorrectOpt) {
                      optStyle = isDark
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-medium"
                        : "border-emerald-200 bg-emerald-50/40 text-emerald-900 font-medium";
                      circleStyle = "bg-emerald-600 text-white border-emerald-600 font-bold";
                      badge = (
                        <span className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isDark
                            ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
                            : "text-emerald-800 bg-emerald-100 border-emerald-200"
                        }`}>
                          ✓ Correct Answer
                        </span>
                      );
                    }

                    return (
                      <div
                        key={opt.label}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition-all ${optStyle}`}
                      >
                        <span
                          className={`h-5 w-5 shrink-0 grid place-items-center rounded-md text-[10px] font-bold border ${circleStyle}`}
                        >
                          {opt.label}
                        </span>
                        <span className="flex-1 leading-snug">{opt.text}</span>
                        {badge}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Summary Pill */}
              <div className={`ml-8 mt-2.5 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2.5 text-xs ${
                isDark ? "border-white/10" : "border-slate-100"
              }`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Your Answer:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        isCorrect
                          ? isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : isWrong
                          ? isDark ? "bg-rose-500/20 text-rose-300" : "bg-rose-50 text-rose-800 border border-rose-200"
                          : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {selectedLabels.length > 0 ? selectedLabels.join(", ") : "Skipped"}
                    </span>
                  </div>

                  {!isCorrect && (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Correct Answer:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}>
                        {correctLabels.join(", ") || "None"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Explanation Section */}
              {q.explanation && (
                <div className={`ml-8 mt-2.5 p-3 rounded-xl border ${
                  isDark ? "bg-black/30 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                }`}>
                  <div className={`flex items-center gap-1.5 text-xs font-bold mb-0.5 ${isDark ? "text-emerald-400" : "text-emerald-800"}`}>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Explanation</span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}

        {displayedQuestions.length === 0 && (
          <div className={`py-10 text-center rounded-2xl border border-dashed ${
            isDark ? "border-white/15 text-slate-400" : "border-slate-200 text-slate-500"
          }`}>
            <p className="text-xs font-semibold">
              {currentTab === "correct"
                ? "No correct answers in this attempt."
                : currentTab === "wrong"
                ? "No wrong answers in this attempt 🎉"
                : currentTab === "unattempted"
                ? "No skipped questions."
                : "No questions to display."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
