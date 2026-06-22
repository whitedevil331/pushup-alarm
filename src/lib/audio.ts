let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let isPlaying = false;

// Create context on import for better chance of autoplay (if user interacted)
try {
  audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
} catch (e) {
  console.warn("AudioContext init failed", e);
}

export function playAlarmSound() {
  if (isPlaying) return;
  isPlaying = true;

  if (!audioContext) {
     try {
       audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
     } catch (e) {
       console.error("Audio Context could not be created");
       return;
     }
  }

  // Attempt to resume if suspended
  if (audioContext.state === 'suspended') {
     audioContext.resume();
  }

  oscillator = audioContext.createOscillator();
  gainNode = audioContext.createGain();

  oscillator.type = 'square';
  // Rapid alternating sequence simulating an alarm
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  
  // Create an alarm loop
  const now = audioContext.currentTime;
  for (let i = 0; i < 1000; i++) {
     oscillator.frequency.setValueAtTime(1000, now + i * 0.5);
     oscillator.frequency.setValueAtTime(800, now + i * 0.5 + 0.25);
  }

  // Volume pulsing
  gainNode.gain.setValueAtTime(0, now);
  for (let i = 0; i < 1000; i++) {
      gainNode.gain.linearRampToValueAtTime(1, now + i * 0.5 + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, now + i * 0.5 + 0.4);
  }

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
}

export function stopAlarmSound() {
  isPlaying = false;
  
  if (oscillator && audioContext) {
    try {
      gainNode?.gain.cancelScheduledValues(audioContext.currentTime);
      gainNode?.gain.setValueAtTime(0, audioContext.currentTime);
      oscillator.stop();
      oscillator.disconnect();
      gainNode?.disconnect();
    } catch(e) {}
    oscillator = null;
    gainNode = null;
  }
}
