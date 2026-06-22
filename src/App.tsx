/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AlarmConfig, UserStats } from './types';
import Dashboard from './components/Dashboard';
import AlarmActive from './components/AlarmActive';

const DEFAULT_STATS: UserStats = {
  streak: 0,
  totalPushups: 0,
  lastCompletedDate: null,
};

const DEFAULT_ALARM: AlarmConfig = {
  timeStr: '07:00',
  targetPushups: 10,
  isActive: false,
};

export default function App() {
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [alarm, setAlarm] = useState<AlarmConfig>(DEFAULT_ALARM);
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    // Load from LocalStorage
    const savedStats = localStorage.getItem('pushup_stats');
    if (savedStats) setStats(JSON.parse(savedStats));

    const savedAlarm = localStorage.getItem('pushup_alarm');
    if (savedAlarm) setAlarm(JSON.parse(savedAlarm));
  }, []);

  useEffect(() => {
    // Check alarm every second
    if (!alarm.isActive || isRinging) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      if (currentTimeStr === alarm.timeStr) {
        setIsRinging(true);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [alarm.isActive, alarm.timeStr, isRinging]);

  const saveStats = (newStats: UserStats) => {
    setStats(newStats);
    localStorage.setItem('pushup_stats', JSON.stringify(newStats));
  };

  const saveAlarm = (newAlarm: AlarmConfig) => {
    setAlarm(newAlarm);
    localStorage.setItem('pushup_alarm', JSON.stringify(newAlarm));
  };

  const handleTestAlarm = () => {
    setIsRinging(true);
  };

  const handleAlarmComplete = (pushupsDone: number, skipped: boolean) => {
    setIsRinging(false);
    
    // Update alarm state so it doesn't immediately ring again
    saveAlarm({ ...alarm, isActive: false });

    const todayStr = new Date().toDateString();

    if (skipped) {
      // Complete reset
      saveStats({
        streak: 0,
        totalPushups: 0,
        lastCompletedDate: null,
      });
    } else {
      // Increment stats
      let newStreak = stats.streak;
      if (stats.lastCompletedDate !== todayStr) {
        // Did we do it yesterday?
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (stats.lastCompletedDate === yesterday.toDateString()) {
          newStreak += 1;
        } else if (!stats.lastCompletedDate) {
          newStreak = 1;
        } else {
          // Missed a day
          newStreak = 1;
        }
      }

      saveStats({
        streak: newStreak,
        totalPushups: stats.totalPushups + pushupsDone,
        lastCompletedDate: todayStr,
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 font-sans text-zinc-100 overflow-hidden">
      {isRinging ? (
        <AlarmActive 
           targetPushups={alarm.targetPushups} 
           onComplete={handleAlarmComplete} 
        />
      ) : (
        <Dashboard 
           stats={stats} 
           alarm={alarm} 
           onSaveAlarm={saveAlarm}
           onTestAlarm={handleTestAlarm}
        />
      )}
    </div>
  );
}
