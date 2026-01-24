import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trophy, Target, TrendingUp, Award, Percent, Zap, Medal } from "lucide-react";
import { Link } from "wouter";
import type { UserStats } from "@shared/schema";
import type { User } from "@shared/models/auth";

interface LeaderboardEntry extends UserStats {
  user: User | null;
}

export default function Stats() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats | null>({
    queryKey: ["/api/stats"],
    enabled: isAuthenticated,
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  const winRate = stats && stats.gamesPlayed > 0 
    ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  const bidSuccessRate = stats && stats.bidsMade > 0
    ? ((stats.bidsSucceeded / stats.bidsMade) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-stats-title">Player Statistics</h1>
        </div>

        {isAuthenticated && user && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="text-xl">
                  {user.firstName?.[0] || user.email?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl" data-testid="text-user-name">
                  {user.firstName} {user.lastName}
                </CardTitle>
                <p className="text-muted-foreground text-sm" data-testid="text-user-email">{user.email}</p>
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    icon={<Trophy className="w-5 h-5 text-amber-500" />}
                    label="Games Won"
                    value={stats.gamesWon}
                    subtext={`${stats.gamesPlayed} played`}
                    testId="stat-games-won"
                  />
                  <StatCard
                    icon={<Percent className="w-5 h-5 text-blue-500" />}
                    label="Win Rate"
                    value={`${winRate}%`}
                    testId="stat-win-rate"
                  />
                  <StatCard
                    icon={<Target className="w-5 h-5 text-green-500" />}
                    label="Bid Success"
                    value={`${bidSuccessRate}%`}
                    subtext={`${stats.bidsSucceeded}/${stats.bidsMade}`}
                    testId="stat-bid-success"
                  />
                  <StatCard
                    icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
                    label="Total Points"
                    value={stats.totalPointsScored}
                    testId="stat-total-points"
                  />
                  <StatCard
                    icon={<Award className="w-5 h-5 text-amber-600" />}
                    label="Highest Bid Made"
                    value={stats.highestBidMade}
                    testId="stat-highest-bid"
                  />
                  <StatCard
                    icon={<Zap className="w-5 h-5 text-red-500" />}
                    label="Times Set"
                    value={stats.timesSet}
                    testId="stat-times-set"
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-stats">
                  No stats yet. Play some games to see your statistics!
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!isAuthenticated && (
          <Card className="mb-6">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4" data-testid="text-login-prompt">
                Log in to track your personal statistics
              </p>
              <Button asChild data-testid="button-login-stats">
                <a href="/api/login">Log In</a>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    data-testid={`leaderboard-entry-${index}`}
                  >
                    <div className="w-8 h-8 flex items-center justify-center">
                      {index === 0 ? (
                        <Medal className="w-6 h-6 text-amber-500" />
                      ) : index === 1 ? (
                        <Medal className="w-6 h-6 text-slate-400" />
                      ) : index === 2 ? (
                        <Medal className="w-6 h-6 text-amber-700" />
                      ) : (
                        <span className="text-muted-foreground font-medium">{index + 1}</span>
                      )}
                    </div>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={entry.user?.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {entry.user?.firstName?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium" data-testid={`leaderboard-name-${index}`}>
                        {entry.user?.firstName || "Unknown"} {entry.user?.lastName || ""}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid={`leaderboard-games-${index}`}>
                        {entry.gamesPlayed} games played
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-sm" data-testid={`leaderboard-wins-${index}`}>
                      {entry.gamesWon} wins
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8" data-testid="text-empty-leaderboard">
                No players on the leaderboard yet. Be the first!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  subtext,
  testId
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  subtext?: string;
  testId?: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-muted/50 text-center" data-testid={testId}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-2xl font-bold" data-testid={testId ? `${testId}-value` : undefined}>{value}</p>
      <p className="text-xs text-muted-foreground" data-testid={testId ? `${testId}-label` : undefined}>{label}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
    </div>
  );
}
