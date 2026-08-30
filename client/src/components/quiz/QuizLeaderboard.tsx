import React, { useState, useEffect } from "react";
import {
  Trophy, Medal, Award, Crown, Search, Clock, Users,
  CheckCircle2, XCircle, HelpCircle, Flame, Sparkles, RefreshCw
} from "lucide-react";
import { getQuizLeaderboard, type QuizLeaderboardResponse, type LeaderboardEntry } from "@/lib/api";

interface QuizLeaderboardProps {
  quizId: string;
  currentUserId?: string;
  theme?: "dark" | "light";
  className?: string;
  onRefresh?: () => void;
}

export function QuizLeaderboard({
  quizId,
  currentUserId,
  theme = "dark",
  className = "",
  onRefresh,
}: QuizLeaderboardProps) {
  const [data, setData] = useState<QuizLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadLeaderboard = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getQuizLeaderboard(quizId);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quizId) {
      loadLeaderboard();
    }
  }, [quizId]);

  const handleRefresh = () => {
    loadLeaderboard();
    if (onRefresh) onRefresh();
  };

  const isDark = theme === "dark";

  if (loading && !data) {
    return (
      <div className={`p-8 rounded-3xl border flex flex-col items-center justify-center gap-3 ${isDark ? "bg-[#160D2E] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900 shadow-sm"
        } ${className}`}>
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          Loading test rankings & leaderboard...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`p-6 rounded-3xl border text-center ${isDark ? "bg-red-500/10 border-red-500/30 text-red-200" : "bg-red-50 border-red-200 text-red-900"
        } ${className}`}>
        <p className="text-sm font-bold">{error}</p>
        <button
          onClick={loadLeaderboard}
          className={`mt-3 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${isDark ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-100 hover:bg-red-200 text-red-900"
            }`}
        >
          Try Again
        </button>
      </div>
    );
  }

  const allEntries = data?.leaderboard || [];
  const top3 = data?.top3 || [];
  const rank1 = top3[0];
  const rank2 = top3[1];
  const rank3 = top3[2];

  const filteredEntries = allEntries.filter(
    (e) =>
      e.studentName.toLowerCase().includes(search.toLowerCase()) ||
      (e.email && e.email.toLowerCase().includes(search.toLowerCase()))
  );

  const formatSec = (sec: number) => {
    if (!sec || sec <= 0) return "< 1m";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const myEntry = data?.myRank || allEntries.find((e) => e.studentId === currentUserId);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header & Stats Bar */}
      <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#160D2E] border-white/10" : "bg-white border-slate-200 shadow-sm"
        }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-display font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
                Classroom Leaderboard
              </h3>
              <p className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Top performers & classroom rankings
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isDark
              ? "bg-white/10 hover:bg-white/20 text-white"
              : "bg-slate-100 hover:bg-slate-200 text-slate-800"
              }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 4 Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className={`p-3 rounded-2xl border text-center ${isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200"
            }`}>
            <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Participants
            </div>
            <div className={`text-xl font-black font-display mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
              {data?.stats?.totalParticipants || 0}
            </div>
          </div>

          <div className={`p-3 rounded-2xl border text-center ${isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200"
            }`}>
            <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Avg Score
            </div>
            <div className={`text-xl font-black font-display mt-0.5 ${isDark ? "text-cyan-400" : "text-blue-700"}`}>
              {data?.stats?.averageScore || 0}%
            </div>
          </div>

          <div className={`p-3 rounded-2xl border text-center ${isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200"
            }`}>
            <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Top Score
            </div>
            <div className={`text-xl font-black font-display mt-0.5 ${isDark ? "text-amber-400" : "text-amber-700"}`}>
              {data?.stats?.topScore || 0} pts
            </div>
          </div>

          <div className={`p-3 rounded-2xl border text-center ${isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200"
            }`}>
            <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Pass Rate
            </div>
            <div className={`text-xl font-black font-display mt-0.5 ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
              {data?.stats?.passRate || 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Pinned "Your Rank" Card */}
      {myEntry && (
        <div className={`p-4 rounded-3xl border relative overflow-hidden ${isDark
          ? "bg-gradient-to-r from-lime/20 via-[#1A1238] to-amber-500/20 border-lime/40"
          : "bg-gradient-to-r from-emerald-50 via-white to-amber-50 border-emerald-300 shadow-sm"
          }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg font-display shadow-md ${myEntry.rank === 1
                  ? "bg-amber-400 text-slate-950 ring-4 ring-amber-400/30"
                  : myEntry.rank === 2
                    ? "bg-slate-300 text-slate-900 ring-4 ring-slate-300/30"
                    : myEntry.rank === 3
                      ? "bg-amber-700 text-amber-100 ring-4 ring-amber-700/30"
                      : isDark
                        ? "bg-lime text-slate-950 ring-4 ring-lime/30"
                        : "bg-emerald-600 text-white ring-4 ring-emerald-600/30"
                  }`}>
                  #{myEntry.rank}
                </div>
                {myEntry.rank <= 3 && (
                  <Crown className="w-4 h-4 text-amber-400 absolute -top-2 -right-1 drop-shadow" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-display font-bold text-base ${isDark ? "text-white" : "text-slate-950"}`}>
                    Your Rank: #{myEntry.rank} of {allEntries.length}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${myEntry.passed
                    ? isDark
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-emerald-100 text-emerald-950 border border-emerald-400"
                    : isDark
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-red-100 text-red-950 border border-red-400"
                    }`}>
                    {myEntry.passed ? "Passed" : "Needs Review"}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Score: <strong className={isDark ? "text-lime font-black" : "text-emerald-800 font-black"}>{myEntry.score}/{myEntry.totalMarks}</strong> ({myEntry.percentage}%) · Time: {formatSec(myEntry.timeTakenSec)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded-xl border text-center ${isDark ? "bg-black/30 border-white/10" : "bg-white border-slate-200"
                }`}>
                <div className={`text-[9px] uppercase font-black ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>Correct</div>
                <div className={`font-mono font-black text-xs ${isDark ? "text-white" : "text-slate-900"}`}>{myEntry.correctCount}</div>
              </div>
              <div className={`px-3 py-1.5 rounded-xl border text-center ${isDark ? "bg-black/30 border-white/10" : "bg-white border-slate-200"
                }`}>
                <div className={`text-[9px] uppercase font-black ${isDark ? "text-rose-400" : "text-rose-700"}`}>Wrong</div>
                <div className={`font-mono font-black text-xs ${isDark ? "text-white" : "text-slate-900"}`}>{myEntry.wrongCount}</div>
              </div>
              <div className={`px-3 py-1.5 rounded-xl border text-center ${isDark ? "bg-black/30 border-white/10" : "bg-white border-slate-200"
                }`}>
                <div className={`text-[9px] uppercase font-black ${isDark ? "text-amber-400" : "text-amber-700"}`}>Skipped</div>
                <div className={`font-mono font-black text-xs ${isDark ? "text-white" : "text-slate-900"}`}>{myEntry.unattemptedCount}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Top 3 Podium Achievers - Responsive 3-by-3 Same-Row Olympic Pedestal */}
      {top3.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Top 3 Podium Achievers
              </h4>
            </div>
            <span className={`text-[11px] font-medium flex items-center gap-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <Sparkles className="w-3 h-3 text-amber-400" /> Olympic Pedestal
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-4 items-end pt-5 sm:pt-6">
            {/* Rank 2 (Silver - Left) */}
            {rank2 ? (
              <div className={`p-2 sm:p-4 rounded-2xl sm:rounded-3xl border flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1 hover:shadow-md shadow-xs ${
                isDark
                  ? "bg-gradient-to-b from-[#1E1638] via-[#181133] to-[#120B29] border-slate-400/30 hover:border-slate-300"
                  : "bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/60 border-slate-300/80"
              }`}>
                <div className={`absolute -top-3 sm:-top-4 px-2 sm:px-3 py-0.5 rounded-full text-[9px] sm:text-[11px] font-black shadow-xs flex items-center gap-1 ring-2 ${
                  isDark
                    ? "bg-slate-300 text-slate-950 border border-slate-200 ring-[#120B29]"
                    : "bg-slate-200 text-slate-800 border border-slate-300 ring-white"
                }`}>
                  <Medal className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 ${isDark ? "text-slate-700" : "text-slate-600"}`} /> 2ND RANK
                </div>
                <div className={`w-9 h-9 sm:w-14 sm:h-14 rounded-2xl border-2 flex items-center justify-center font-display font-bold text-sm sm:text-xl mt-1 shadow-sm ${
                  isDark
                    ? "bg-slate-400/20 border-slate-300/80 text-slate-200 ring-2 ring-slate-400/30"
                    : "bg-gradient-to-br from-slate-100 to-slate-300 border-white text-slate-800 ring-2 ring-slate-300/50"
                }`}>
                  {rank2.studentName.charAt(0).toUpperCase()}
                </div>
                <h5 className={`font-display font-bold text-[11px] sm:text-sm mt-1.5 truncate w-full px-0.5 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}>
                  {rank2.studentName}
                </h5>
                <div className={`text-[11px] sm:text-base font-mono font-black mt-0.5 leading-tight ${
                  isDark ? "text-slate-200" : "text-slate-900"
                }`}>
                  {rank2.percentage}%
                </div>
                <div className={`text-[9px] sm:text-xs font-mono font-bold ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}>
                  {rank2.score}/{rank2.totalMarks} Marks
                </div>
                <div className={`text-[9px] sm:text-xs font-medium mt-0.5 hidden xs:block truncate max-w-full ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  {(rank2.correctCount ?? 0) + (rank2.wrongCount ?? 0)} Qs Attended
                </div>
                <div className={`text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-medium ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" /> {formatSec(rank2.timeTakenSec)}
                </div>
                {/* Stepped Pedestal Base */}
                <div className={`mt-2.5 sm:mt-3.5 w-full h-7 sm:h-10 rounded-xl flex items-center justify-center font-display font-black text-sm sm:text-lg shadow-inner ${
                  isDark
                    ? "bg-gradient-to-b from-slate-600/80 to-slate-700 text-slate-200 border-t border-slate-400/40"
                    : "bg-gradient-to-b from-slate-300 to-slate-400 text-slate-800 border-t border-slate-100"
                }`}>
                  2
                </div>
              </div>
            ) : (
              <div className={`p-2 sm:p-4 rounded-2xl sm:rounded-3xl border border-dashed text-center opacity-40 ${
                isDark ? "border-white/20 bg-white/5" : "border-slate-200 bg-slate-50/50"
              }`}>
                <p className="text-[10px] sm:text-xs py-6 text-slate-400">No 2nd rank</p>
              </div>
            )}

            {/* Rank 1 (Gold - Center Champion with Animated Wings) */}
            {rank1 && (
              <div className={`p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl shadow-md ring-2 sm:ring-4 ${
                isDark
                  ? "border-amber-400/80 bg-gradient-to-b from-amber-500/20 via-[#2A1A4E] to-[#1F1340] ring-amber-400/30"
                  : "border-amber-300/90 bg-gradient-to-b from-amber-50 via-amber-100/50 to-amber-200/60 ring-amber-400/25"
              }`}>
                {/* Animated Golden Wings Behind Avatar */}
                <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 w-28 sm:w-44 h-10 sm:h-14 pointer-events-none z-0 flex items-center justify-between">
                  {/* Left Wing */}
                  <svg
                    viewBox="0 0 100 70"
                    className="w-11 h-8 sm:w-16 sm:h-12 animate-wing-left -mr-2 sm:-mr-3"
                  >
                    <defs>
                      <linearGradient id="podiumGoldWingL" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FEF08A" />
                        <stop offset="35%" stopColor="#FBBF24" />
                        <stop offset="75%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#D97706" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M95,55 C70,48 45,32 20,8 C12,0 0,-3 0,5 C0,10 10,18 22,25 C10,22 2,28 4,34 C6,40 18,42 30,44 C18,44 10,50 14,56 C18,62 34,58 48,56 C36,60 30,68 36,70 C42,72 65,65 95,55 Z"
                      fill="url(#podiumGoldWingL)"
                    />
                    <path
                      d="M85,50 C65,44 45,30 25,12 C18,7 8,5 8,9 C10,14 18,20 28,26 C18,24 12,28 14,33 C16,38 26,40 36,42 C26,42 20,47 24,51 C28,55 42,52 54,50"
                      fill="none"
                      stroke="#FFF"
                      strokeOpacity="0.5"
                      strokeWidth="1.5"
                    />
                  </svg>

                  {/* Right Wing */}
                  <svg
                    viewBox="0 0 100 70"
                    className="w-11 h-8 sm:w-16 sm:h-12 animate-wing-right -ml-2 sm:-ml-3"
                  >
                    <defs>
                      <linearGradient id="podiumGoldWingR" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FEF08A" />
                        <stop offset="35%" stopColor="#FBBF24" />
                        <stop offset="75%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#D97706" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M5,55 C30,48 55,32 80,8 C88,0 100,-3 100,5 C100,10 90,18 78,25 C90,22 98,28 96,34 C94,40 82,42 70,44 C82,44 90,50 86,56 C82,62 66,58 52,56 C64,60 70,68 64,70 C58,72 35,65 5,55 Z"
                      fill="url(#podiumGoldWingR)"
                    />
                    <path
                      d="M15,50 C35,44 55,30 75,12 C82,7 92,5 92,9 C90,14 82,20 72,26 C82,24 88,28 86,33 C84,38 74,40 64,42 C74,42 80,47 76,51 C72,55 58,52 46,50"
                      fill="none"
                      stroke="#FFF"
                      strokeOpacity="0.5"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

                <div className={`absolute -top-4 sm:-top-5 px-2.5 sm:px-4 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 text-[10px] sm:text-xs font-black shadow-md flex items-center gap-1 sm:gap-1.5 animate-bounce ring-2 z-10 ${
                  isDark ? "ring-[#1F1340]" : "ring-white"
                }`}>
                  <Crown className="w-3 h-3 sm:w-4 sm:h-4 fill-current" /> 1ST RANK 🏆
                </div>
                <div className="relative mt-1 z-10">
                  <div className={`w-11 h-11 sm:w-16 sm:h-16 rounded-2xl border-2 sm:border-3 shadow-md flex items-center justify-center font-display font-black text-base sm:text-2xl ring-2 sm:ring-3 ${
                    isDark
                      ? "bg-amber-400/25 border-amber-400 text-amber-300 ring-amber-400/40"
                      : "bg-gradient-to-br from-amber-200 to-amber-400 border-white text-amber-950 ring-amber-400/50"
                  }`}>
                    {rank1.studentName.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 text-slate-950 border border-white flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs">
                    🏆
                  </span>
                </div>
                <h5 className={`font-display font-black text-xs sm:text-base mt-2 truncate w-full px-1 z-10 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}>
                  {rank1.studentName}
                </h5>
                <div className={`text-xs sm:text-lg font-mono font-black mt-0.5 leading-tight z-10 ${
                  isDark ? "text-amber-300" : "text-amber-950"
                }`}>
                  {rank1.percentage}%
                </div>
                <div className={`text-[10px] sm:text-xs font-mono font-bold z-10 ${
                  isDark ? "text-amber-200" : "text-amber-900/90"
                }`}>
                  {rank1.score}/{rank1.totalMarks} Marks
                </div>
                <div className={`mt-1.5 inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md border z-10 ${
                  isDark
                    ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"
                    : "text-emerald-800 bg-emerald-100/90 border border-emerald-200"
                }`}>
                  <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {rank1.correctCount} Correct
                </div>
                <div className={`text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-semibold z-10 ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}>
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500" /> {formatSec(rank1.timeTakenSec)}
                </div>
                {/* Stepped Pedestal Base */}
                <div className={`mt-2.5 sm:mt-3.5 w-full h-10 sm:h-14 rounded-xl flex items-center justify-center text-slate-950 font-display font-black text-base sm:text-2xl shadow-inner z-10 ${
                  isDark
                    ? "bg-gradient-to-b from-amber-400 to-amber-500 border-t border-amber-300/50"
                    : "bg-gradient-to-b from-amber-400 to-amber-500 border-t border-amber-200"
                }`}>
                  1
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze - Right) */}
            {rank3 ? (
              <div className={`p-2 sm:p-4 rounded-2xl sm:rounded-3xl border flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1 hover:shadow-md shadow-xs ${
                isDark
                  ? "bg-gradient-to-b from-[#22132D] via-[#1A0E26] to-[#140820] border-amber-700/40 hover:border-amber-700/60"
                  : "bg-gradient-to-b from-amber-50/40 via-amber-100/40 to-amber-200/50 border-amber-200/80"
              }`}>
                <div className={`absolute -top-3 sm:-top-4 px-2 sm:px-3 py-0.5 rounded-full text-[9px] sm:text-[11px] font-black shadow-xs flex items-center gap-1 ring-2 ${
                  isDark
                    ? "bg-amber-700 text-amber-100 border border-amber-600 ring-[#140820]"
                    : "bg-amber-100 text-amber-900 border border-amber-300 ring-white"
                }`}>
                  <Medal className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 ${isDark ? "text-amber-300" : "text-amber-700"}`} /> 3RD RANK
                </div>
                <div className={`w-9 h-9 sm:w-14 sm:h-14 rounded-2xl border-2 flex items-center justify-center font-display font-bold text-sm sm:text-xl mt-1 shadow-sm ${
                  isDark
                    ? "bg-amber-800/30 border-amber-700 text-amber-200 ring-2 ring-amber-700/40"
                    : "bg-gradient-to-br from-amber-100 to-amber-300 border-white text-amber-900 ring-2 ring-amber-300/50"
                }`}>
                  {rank3.studentName.charAt(0).toUpperCase()}
                </div>
                <h5 className={`font-display font-bold text-[11px] sm:text-sm mt-1.5 truncate w-full px-0.5 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}>
                  {rank3.studentName}
                </h5>
                <div className={`text-[11px] sm:text-base font-mono font-black mt-0.5 leading-tight ${
                  isDark ? "text-amber-300" : "text-slate-900"
                }`}>
                  {rank3.percentage}%
                </div>
                <div className={`text-[9px] sm:text-xs font-mono font-bold ${
                  isDark ? "text-amber-200" : "text-slate-600"
                }`}>
                  {rank3.score}/{rank3.totalMarks} Marks
                </div>
                <div className={`text-[9px] sm:text-xs font-medium mt-0.5 hidden xs:block truncate max-w-full ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  {(rank3.correctCount ?? 0) + (rank3.wrongCount ?? 0)} Qs Attended
                </div>
                <div className={`text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-medium ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}>
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" /> {formatSec(rank3.timeTakenSec)}
                </div>
                {/* Stepped Pedestal Base */}
                <div className={`mt-2.5 sm:mt-3.5 w-full h-5 sm:h-8 rounded-xl flex items-center justify-center font-display font-black text-xs sm:text-base shadow-inner ${
                  isDark
                    ? "bg-gradient-to-b from-amber-700 to-amber-800 text-amber-100 border-t border-amber-500/40"
                    : "bg-gradient-to-b from-amber-300 to-amber-400 text-amber-950 border-t border-amber-100"
                }`}>
                  3
                </div>
              </div>
            ) : (
              <div className={`p-2 sm:p-4 rounded-2xl sm:rounded-3xl border border-dashed text-center opacity-40 ${
                isDark ? "border-white/20 bg-white/5" : "border-slate-200 bg-slate-50/50"
              }`}>
                <p className="text-[10px] sm:text-xs py-6 text-slate-400">No 3rd rank</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Ranklist Table */}
      <div className={`rounded-3xl border overflow-hidden ${isDark ? "bg-[#160D2E] border-white/10" : "bg-white border-slate-200 shadow-sm"
        }`}>
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${isDark ? "border-white/10" : "border-slate-200"
          }`}>
          <h4 className={`font-display font-bold text-sm flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            <Award className="w-4 h-4 text-amber-500" />
            <span>Complete Rank List ({allEntries.length})</span>
          </h4>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs w-full sm:w-64 ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
            }`}>
            <Search className="w-3.5 h-3.5 opacity-60" />
            <input
              type="text"
              placeholder="Search student rank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border-none outline-none text-xs w-full ${isDark ? "placeholder:text-slate-400 text-white" : "placeholder:text-slate-500 text-slate-900"
                }`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`text-[10px] uppercase font-black tracking-wider border-b ${isDark ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-800"
                }`}>
                <th className="py-3 px-4 w-16">Rank</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4 text-center">%</th>
                <th className="py-3 px-4 text-center">Breakdown</th>
                <th className="py-3 px-4 text-center">Time</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-white/5" : "divide-slate-200"}`}>
              {filteredEntries.map((entry) => {
                const isMe = entry.studentId === currentUserId;
                const isTop1 = entry.rank === 1;
                const isTop2 = entry.rank === 2;
                const isTop3 = entry.rank === 3;

                return (
                  <tr
                    key={entry.studentId}
                    className={`transition-colors ${isMe
                      ? isDark
                        ? "bg-lime/10 font-semibold"
                        : "bg-emerald-50 font-semibold"
                      : isDark
                        ? "hover:bg-white/5"
                        : "hover:bg-slate-50"
                      }`}
                  >
                    <td className="py-3 px-4">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${isTop1
                        ? "bg-amber-400 text-slate-950 shadow-xs"
                        : isTop2
                          ? "bg-slate-300 text-slate-900"
                          : isTop3
                            ? "bg-amber-700 text-amber-100"
                            : isDark
                              ? "bg-white/10 text-white font-bold"
                              : "bg-slate-200 text-slate-900 font-bold"
                        }`}>
                        #{entry.rank}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs uppercase ${isMe
                          ? "bg-lime text-slate-950 font-black"
                          : isDark
                            ? "bg-white/10 text-white"
                            : "bg-slate-200 text-slate-800"
                          }`}>
                          {entry.studentName.charAt(0)}
                        </div>
                        <div>
                          <div className={`font-bold flex items-center gap-1.5 ${isDark ? "text-white" : "text-slate-950"}`}>
                            <span>{entry.studentName}</span>
                            {isMe && (
                              <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-lime text-slate-950 uppercase">
                                You
                              </span>
                            )}
                          </div>
                          {entry.email && (
                            <div className={`text-[10px] truncate max-w-[150px] sm:max-w-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                              {entry.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className={`py-3 px-4 text-center font-mono font-black ${isDark ? "text-white" : "text-slate-950"}`}>
                      {entry.score}/{entry.totalMarks}
                    </td>

                    <td className={`py-3 px-4 text-center font-mono font-black ${isDark ? "text-lime" : "text-emerald-800"}`}>
                      {entry.percentage}%
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] font-black">
                        <span className={isDark ? "text-emerald-400" : "text-emerald-800"} title="Correct">
                          ✓ {entry.correctCount}
                        </span>
                        <span className={isDark ? "text-rose-400" : "text-rose-800"} title="Wrong">
                          ✗ {entry.wrongCount}
                        </span>
                        <span className={isDark ? "text-amber-400" : "text-amber-800"} title="Skipped">
                          ⊘ {entry.unattemptedCount}
                        </span>
                      </div>
                    </td>

                    <td className={`py-3 px-4 text-center font-mono text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      {formatSec(entry.timeTakenSec)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${entry.passed
                        ? isDark
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-emerald-100 text-emerald-950 border border-emerald-400"
                        : isDark
                          ? "bg-red-500/20 text-red-400"
                          : "bg-red-100 text-red-950 border border-red-400"
                        }`}>
                        {entry.passed ? "Pass" : "Fail"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-8 text-center font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    No matching student ranks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
