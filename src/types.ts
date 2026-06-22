export interface UserStats {
  streak: number;
  totalPushups: number;
  lastCompletedDate: string | null;
}

export interface AlarmConfig {
  timeStr: string; // "HH:MM"
  targetPushups: number;
  isActive: boolean;
}
