import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Video, 
  FileText, 
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingUp
} from "lucide-react";

interface ProgressStatsProps {
  stats: {
    attendance: {
      total: number;
      attended: number;
      percentage: number;
    };
    videos: {
      total: number;
      completed: number;
      percentage: number;
      watchedSec: number;
      totalSec: number;
    };
    quizzes: {
      total: number;
      completed: number;
      percentage: number;
      avgScore: number;
    };
    overallProgress: number;
  };
}

const ProgressStats: React.FC<ProgressStatsProps> = ({ stats }) => {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card className="border-2 border-primary/10">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Overall Learning Progress
              </p>
              <h3 className="text-3xl font-bold mt-1">{stats.overallProgress}%</h3>
            </div>
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <Progress value={stats.overallProgress} className="h-3" />
          <p className="text-xs text-muted-foreground mt-3">
            Your overall progress is calculated based on live attendance (30%), video watching (40%), and quiz performance (30%).
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attendance */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Live Attendance</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendance.percentage}%</div>
            <Progress value={stats.attendance.percentage} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {stats.attendance.attended} / {stats.attendance.total} sessions
            </p>
          </CardContent>
        </Card>

        {/* Videos */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Video Progress</CardTitle>
            <Video className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.videos.percentage}%</div>
            <Progress value={stats.videos.percentage} className="h-2 mt-2" />
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {stats.videos.completed} / {stats.videos.total} videos watched
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(stats.videos.watchedSec)} watched
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quizzes */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Quiz Analytics</CardTitle>
            <FileText className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.quizzes.avgScore}%</div>
            <Progress value={stats.quizzes.avgScore} className="h-2 mt-2" />
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {stats.quizzes.completed} / {stats.quizzes.total} quizzes taken
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Avg Score: {stats.quizzes.avgScore}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProgressStats;
