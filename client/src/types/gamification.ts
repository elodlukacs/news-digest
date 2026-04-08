export interface GamificationStats {
  current_streak: number;
  longest_streak: number;
  total_antibodies: number;
  last_challenge_date: string | null;
  recovery_boosts_used: number;
  completed_today: boolean;
  dojo: {
    total_sessions: number;
    correct: number;
    accuracy: number;
    avg_time_ms: number | null;
  };
  bias_fingerprints_count: number;
  inoculation_sessions: number;
}

export interface ChallengeResult {
  current_streak: number;
  longest_streak: number;
  total_antibodies: number;
  last_challenge_date: string | null;
  already_completed: boolean;
  streak_continued: boolean;
  message: string;
}

export interface RecoveryResult {
  current_streak: number;
  longest_streak: number;
  recovery_boosts_used: number;
  last_challenge_date: string | null;
  recovered: boolean;
  message: string;
}
