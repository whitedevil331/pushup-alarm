import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { PushupCounter } from '../lib/pushupDetector';
import { playAlarmSound, stopAlarmSound } from '../lib/audio';
import { ShieldAlert, SkipForward, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AlarmActiveProps {
  targetPushups: number;
  onComplete: (completedPushups: number, skipped: boolean) => void;
}

export default function AlarmActive({ targetPushups, onComplete }: AlarmActiveProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [modelLoadingError, setModelLoadingError] = useState<string | null>(null);
  const [pushupCount, setPushupCount] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [finished, setFinished] = useState(false);
  const [wakeUpAcknowledged, setWakeUpAcknowledged] = useState(false);
  const [lastSpokenCount, setLastSpokenCount] = useState(0);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Use refs to access latest values in the estimation loop
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const counterRef = useRef<PushupCounter>(new PushupCounter());
  const requestRef = useRef<number>(0);
  const finishedRef = useRef(false);
  const pushupCountRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  
  useEffect(() => {
    // Play initial alarm
    if (!wakeUpAcknowledged && !finished) {
       playAlarmSound();
    } else {
       stopAlarmSound();
    }
    return () => stopAlarmSound();
  }, [wakeUpAcknowledged, finished]);

  useEffect(() => {
    if (pushupCount > lastSpokenCount) {
      setLastSpokenCount(pushupCount);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(pushupCount.toString());
      window.speechSynthesis.speak(utterance);
    }
  }, [pushupCount, lastSpokenCount]);

  useEffect(() => {
    if (!wakeUpAcknowledged) return;

    // Start Webcam
    const setupCamera = async () => {
      try {
        // Explicitly request permissions via Capacitor if available
        if (typeof window !== 'undefined' && 'Capacitor' in window) {
           const { Camera } = await import('@capacitor/camera');
           const permissionResponse = await Camera.requestPermissions({ permissions: ['camera'] });
           if (permissionResponse.camera !== 'granted') {
             throw new Error('Camera permission not granted');
           }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false, // We don't need audio
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (err) {
        console.error('Error accessing camera', err);
        setCameraError(true);
      }
    };

    setupCamera();

    // Initialize TensorFlow and Model
    const initModel = async () => {
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
        detectorRef.current = detector;
        setIsLoaded(true);
      } catch (err: any) {
        console.error("Failed to load model", err);
        setModelLoadingError("Could not load pose detection AI.");
      }
    };

    initModel();

    return () => {
      stopAlarmSound();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [wakeUpAcknowledged]);

  useEffect(() => {
    if (!isLoaded || finished || cameraError || !wakeUpAcknowledged) return;

    const detect = async () => {
      if (
        finishedRef.current ||
        !videoRef.current ||
        videoRef.current.readyState !== 4 ||
        !detectorRef.current
      ) {
         if (!finishedRef.current) requestRef.current = requestAnimationFrame(detect);
         return;
      }

      const video = videoRef.current;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Make sure canvas is same size as video
      video.width = videoWidth;
      video.height = videoHeight;
      if (canvasRef.current) {
         canvasRef.current.width = videoWidth;
         canvasRef.current.height = videoHeight;
      }

      const poses = await detectorRef.current.estimatePoses(video);
      
      const result = counterRef.current.update(poses);
      
      // Update React state only when count changes to avoid re-render lag during requestAnimationFrame
      if (result.count !== pushupCountRef.current) {
         pushupCountRef.current = result.count;
         setPushupCount(result.count);
      }

      // Draw skeleton
      if (canvasRef.current) {
         const ctx = canvasRef.current.getContext('2d');
         if (ctx) {
            ctx.clearRect(0, 0, videoWidth, videoHeight);
            
            // Draw Keypoints
            result.keypoints.forEach((keypoint) => {
               if (keypoint.score && keypoint.score > 0.3) {
                  ctx.beginPath();
                  ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
                  ctx.fillStyle = result.stage === 'down' ? '#ef4444' : '#a3e635'; // red or lime
                  ctx.fill();
               }
            });

            // Draw Skeleton lines with different color based on stage
            const lineColor = result.stage === 'down' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(163, 230, 53, 0.8)';
            const lineWidth = 6;
            
            const drawLine = (p1Name: string, p2Name: string) => {
               const p1 = result.keypoints.find(k => k.name === p1Name);
               const p2 = result.keypoints.find(k => k.name === p2Name);
               if (p1 && p2 && p1.score && p1.score > 0.3 && p2.score && p2.score > 0.3) {
                 ctx.beginPath();
                 ctx.moveTo(p1.x, p1.y);
                 ctx.lineTo(p2.x, p2.y);
                 ctx.strokeStyle = lineColor;
                 ctx.lineWidth = lineWidth;
                 ctx.lineCap = 'round';
                 ctx.stroke();
               }
            }

            // Arms
            drawLine('left_shoulder', 'left_elbow');
            drawLine('left_elbow', 'left_wrist');
            drawLine('right_shoulder', 'right_elbow');
            drawLine('right_elbow', 'right_wrist');
            // Shoulders
            drawLine('left_shoulder', 'right_shoulder');
            // Torso
            drawLine('left_shoulder', 'left_hip');
            drawLine('right_shoulder', 'right_hip');
            drawLine('left_hip', 'right_hip');
            
            // Visual feedback of the angle as a bar on the side
            if (result.angle) {
               ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
               ctx.fillRect(10, 10, 20, 200);
               const fillHeight = Math.min(200, Math.max(0, ((result.angle - 60) / 100) * 200));
               ctx.fillStyle = result.stage === 'down' ? '#ef4444' : '#a3e635';
               ctx.fillRect(10, 210 - fillHeight, 20, fillHeight);
               
               // Draw threshold line
               ctx.strokeStyle = '#ffffff';
               ctx.lineWidth = 2;
               ctx.beginPath();
               ctx.moveTo(8, 210 - ((100 - 60) / 100) * 200); // 100 deg threshold
               ctx.lineTo(32, 210 - ((100 - 60) / 100) * 200);
               ctx.stroke();
            }
         }
      }

      if (result.count >= targetPushups) {
         handleFinished();
      } else {
         requestRef.current = requestAnimationFrame(detect);
      }
    };

    detect();

  }, [isLoaded, targetPushups, finished, cameraError, wakeUpAcknowledged]);

  const handleFinished = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    stopAlarmSound();
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#a3e635', '#ffffff', '#bef264']
    });
  };

  const handleSkip = () => {
    setShowSkipConfirm(true);
  };

  const confirmSkip = () => {
    stopAlarmSound();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    onComplete(pushupCount, true);
  }

  const handleDone = () => {
    onComplete(pushupCount, false);
  };

  if (!wakeUpAcknowledged) {
     return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center space-y-6 animate-in fade-in zoom-in duration-300">
           <div className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center border-8 border-red-900 shadow-[0_0_80px_rgba(220,38,38,0.6)] animate-pulse">
             <ShieldAlert className="w-16 h-16 text-white" />
           </div>
           <h1 className="text-6xl font-black text-white tracking-tighter uppercase px-4 leading-none">Wake <br/><span className="text-red-500">Up!</span></h1>
           <p className="text-zinc-400 text-sm max-w-xs uppercase tracking-widest font-bold mt-4">
              Complete <span className="text-white text-base">{targetPushups} pushups</span> to unlock your device.
           </p>
           <button 
             onClick={() => setWakeUpAcknowledged(true)}
             className="w-full max-w-xs py-6 mt-8 bg-white hover:bg-zinc-200 text-black font-black rounded-2xl transition-transform active:scale-95 shadow-xl uppercase tracking-[0.2em] text-lg"
           >
              Let's Go
           </button>
        </div>
     );
  }

  if (finished) {
     return (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center space-y-6 animate-in fade-in zoom-in duration-500">
           <div className="w-24 h-24 bg-lime-500/20 rounded-full flex items-center justify-center border border-lime-500/50">
             <CheckCircle2 className="w-12 h-12 text-lime-400" />
           </div>
           <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Mission <br/>Accomplished</h1>
           <p className="text-zinc-400 text-sm tracking-widest uppercase font-bold max-w-xs mt-2">
              You completed <span className="text-lime-400 text-base">{pushupCount}</span> pushups!
           </p>
           <button 
             onClick={handleDone}
             className="w-full max-w-xs py-5 mt-8 bg-lime-500 hover:bg-lime-400 text-black font-black rounded-2xl transition-transform active:scale-95 shadow-[0_0_30px_rgba(163,230,53,0.3)] uppercase tracking-widest text-sm"
           >
              Dismiss Alarm
           </button>
        </div>
     );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col pt-safe pb-safe px-4 sm:px-8 gap-4 overflow-hidden">
      
      {/* Skip Confirmation Modal */}
      {showSkipConfirm && (
        <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-4 leading-none">Delete<br/>Everything?</h2>
            <p className="text-zinc-400 text-xs uppercase tracking-widest leading-loose mb-10 max-w-[280px]">
               Skipping will instantly delete your lifetime pushup count and reset your streak to 0. Are you absolutely sure?
            </p>
            <div className="flex w-full max-w-xs gap-4 flex-col">
               <button 
                 onClick={confirmSkip}
                 className="w-full py-5 bg-red-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-500 active:scale-95 transition-all shadow-lg shadow-red-900/50"
               >
                 Delete My Data
               </button>
               <button 
                 onClick={() => setShowSkipConfirm(false)}
                 className="w-full py-5 bg-zinc-800 text-white font-bold uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-700 active:scale-95 transition-all"
               >
                 Nevermind
               </button>
            </div>
        </div>
      )}

      {/* Top Banner (Ringing Warning) */}
      <div className="flex justify-between items-center z-20 shrink-0 pt-6">
        <div className="flex items-center text-lime-400 animate-pulse bg-lime-400/10 px-4 py-2 rounded-full border border-lime-400/20">
           <div className="w-2 h-2 rounded-full bg-lime-400 mr-2"></div>
           <span className="font-bold tracking-widest uppercase text-[10px]">AI Vision Active</span>
        </div>
        <button 
           onClick={handleSkip}
           className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-5 py-2.5 rounded-full font-bold uppercase text-[10px] tracking-widest hover:bg-zinc-800 hover:text-white transition-colors flex items-center"
        >
           <SkipForward className="w-4 h-4 sm:mr-2" />
           <span className="hidden sm:inline">Skip & Reset Data</span>
        </button>
      </div>

      {/* Main Video View */}
      <div className="flex-1 relative rounded-[2rem] border-2 border-zinc-800 overflow-hidden bg-zinc-900 flex items-center justify-center mb-6">
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-orange-400 bg-zinc-950 z-50 uppercase tracking-widest text-xs font-bold leading-loose">
             Camera access is required.<br/>Please allow permissions.
          </div>
        )}
        
        {modelLoadingError && (
           <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-orange-400 bg-zinc-950 z-50 uppercase tracking-widest text-xs font-bold">
              {modelLoadingError}
           </div>
        )}

        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute w-full h-full object-cover scale-x-[-1]" 
        />
        {/* Note: scale-x-[-1] mirrors the camera intuitively for the user */}
        
        {/* Canvas for Drawing Skeleton overlay */}
        <canvas
          ref={canvasRef}
          className="absolute w-full h-full object-cover z-10 pointer-events-none scale-x-[-1]"
        />
        <div className="absolute inset-0 border border-white/5 pointer-events-none rounded-[2rem] z-20"></div>

        {/* Loading overlay if AI isn't ready */}
        {!isLoaded && !cameraError && !modelLoadingError && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-30 text-white">
              <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="font-mono text-sm uppercase tracking-[0.2em] text-lime-400">Loading AI...</p>
           </div>
        )}

        {/* Target Overlay Center */}
        {isLoaded && !finished && (
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-30 pointer-events-none bg-black/50 backdrop-blur-md px-8 py-4 rounded-3xl border border-white/10">
              <div className="text-[100px] font-black text-white leading-none drop-shadow-[0_0_30px_rgba(163,230,53,0.5)] tabular-nums tracking-tighter">
                 {pushupCount} <span className="text-4xl text-zinc-500">/ {targetPushups}</span>
              </div>
              <div className="text-lime-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2">
                 Pushups
              </div>
           </div>
        )}
      </div>

    </div>
  );
}
