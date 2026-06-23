export type WellnessCategory = {
  id: string;
  name: string;
  scoreValue: number;
  icon: string | null;
};

export type WellnessEvent = {
  id: string;
  title: string;
  dateTime: string;
  durationMinutes: number;
  locationType: "online" | "meeting_room" | "dharma_space";
  locationDetail: string | null;
  maxSpots: number;
  spotsLeft: number;
  bookedCount: number;
  status: string;
  category: WellnessCategory;
  trainer: { id: string; name: string; avatar: string | null } | null;
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  fullName: string;
  avatarUrl: string | null;
  department: string;
  totalWellnessScore: number;
};

export type WellnessStats = {
  totalWellnessScore: number;
  totalSteps: number;
  attendancePct: number;
  attendanceByCategory: Array<{ categoryName: string; icon: string | null; count: number }>;
  wellnessLevel: {
    emoji: string;
    title: string;
    description: string;
    level: number;
    percentage: number;
    nextLevelAt: number | null;
  };
  badges: Array<{ name: string; emoji: string; description: string; unlockedAt: string }>;
  departmentRank: { rank: number | null; totalDepts: number };
};

export type DepartmentLeaderboardEntry = {
  rank: number;
  id: string;
  name: string;
  avgAttendancePct: number;
  totalEventsAttended: number;
  weekStreak: number;
  mostImproved: boolean;
};

export type WellnessBooking = {
  id: string;
  cancelled: boolean;
  bookedAt: string;
  attended?: boolean;
  event: WellnessEvent;
};

export type BadgeDefinition = {
  name: string;
  description: string;
  icon: string;
};
