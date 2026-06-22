import { useEffect, useState } from 'react';
import { AlarmConfig, UserStats } from '../types';
import { Flame, Activity, Power, Clock, Plus, Minus, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Dashboard({ 
  stats, 
  alarm, 
  onSaveAlarm,
  onTestAlarm
}: { 
  stats: UserStats; 
  alarm: AlarmConfig; 
  onSaveAlarm: (a: AlarmConfig) => void;
  onTestAlarm: () => void;
}) {
  const [timeStr, setTimeStr] = useState(alarm.timeStr);
  const [targetPushups, setTargetPushups] = useState(alarm.targetPushups);

  const handleSaveTime = (newTime: string) => {
    setTimeStr(newTime);
    onSaveAlarm({ ...alarm, timeStr: newTime });
  };

  const updatePushups = (delta: number) => {
    const newVal = Math.max(1, Math.min(100, targetPushups + delta));
    setTargetPushups(newVal);
    onSaveAlarm({ ...alarm, targetPushups: newVal });
  };

  const handleToggleActive = () => {
    onSaveAlarm({ ...alarm, isActive: !alarm.isActive });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-950 text-white selection:bg-lime-500/30 font-sans">
      
      {/* Header */}
      <header className="pt-6 pb-4 px-6 shrink-0 flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">Push<span className="text-lime-400">Power</span></h1>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Streak</span>
            <div className="flex items-center text-orange-500 font-black text-xl">
               <Flame className="w-5 h-5 mr-1" />
               {stats.streak}
            </div>
          </div>
          <div className="w-px bg-zinc-800 my-1"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Total</span>
            <div className="flex items-center text-lime-400 font-black text-xl">
               <Activity className="w-5 h-5 mr-1" />
               {stats.totalPushups}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-6 max-w-md mx-auto w-full mb-auto pb-safe">
        
        {/* Main Alarm Toggle Card */}
        <div className={cn(
          "relative rounded-[2rem] p-[2px] transition-all duration-500 mt-4 shadow-2xl",
          alarm.isActive ? "bg-gradient-to-br from-lime-400 to-emerald-600 shadow-lime-500/20" : "bg-zinc-800"
        )}>
          <div className="bg-zinc-950 rounded-[2rem] p-8 flex flex-col items-center relative overflow-hidden">
            {alarm.isActive && (
              <div className="absolute inset-0 bg-lime-500/5 pointer-events-none"></div>
            )}
            
            <button 
              onClick={handleToggleActive}
              className={cn(
                "p-5 rounded-full mb-8 transition-all duration-300 transform active:scale-95",
                alarm.isActive 
                  ? "bg-lime-400 text-zinc-950 shadow-[0_0_40px_rgba(163,230,53,0.4)] hover:bg-lime-300" 
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              )}
            >
              <Power className="w-10 h-10" />
            </button>

            <div className="relative group w-full flex justify-center">
              <input 
                type="time" 
                value={timeStr}
                onChange={(e) => handleSaveTime(e.target.value)}
                className="bg-transparent text-6xl sm:text-7xl font-black tabular-nums tracking-tighter outline-none text-center cursor-pointer appearance-none z-10 w-full"
                style={{ WebkitAppearance: 'none' }}
              />
            </div>
            <div className="text-zinc-500 font-bold tracking-[0.2em] uppercase text-xs mt-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Alarm Target Time
            </div>
          </div>
        </div>

        {/* Pushups Target Control */}
        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800/50 mt-2">
           <h3 className="text-center text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Daily Pushup Target</h3>
           
           <div className="flex items-center justify-between">
              <button 
                onClick={() => updatePushups(-5)}
                className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-90 transition-all border border-zinc-700/50"
              >
                <Minus className="w-8 h-8" />
              </button>
              
              <div className="flex flex-col items-center w-24">
                <span className="text-6xl font-black tracking-tighter text-lime-400 tabular-nums">
                  {targetPushups}
                </span>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Reps</span>
              </div>

              <button 
                onClick={() => updatePushups(5)}
                className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-90 transition-all border border-zinc-700/50"
              >
                <Plus className="w-8 h-8" />
              </button>
           </div>
        </div>

        {/* Warning / Test Actions */}
        <div className="mt-auto space-y-4 pt-4">
           <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start">
             <ShieldAlert className="w-5 h-5 text-red-400 mr-3 shrink-0" />
             <p className="text-xs text-red-200/70 leading-relaxed font-medium">
               <strong className="text-red-400 block mb-1 uppercase tracking-wider text-[10px]">Strict Enforcement</strong>
               If you skip the alarm, ALL your streak and data will be permanently deleted. No exceptions.
             </p>
           </div>

           <button 
             onClick={onTestAlarm}
             className="w-full py-5 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-2xl transition-colors border border-zinc-700 uppercase tracking-widest text-sm shadow-xl active:scale-[0.98]"
           >
             Test Alarm Trigger
           </button>
        </div>
      </main>
    </div>
  );
}
