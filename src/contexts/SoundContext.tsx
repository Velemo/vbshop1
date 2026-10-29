import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";

type SoundContextValue = {
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
  audioReady: boolean;
  enableAudio: () => void;
  playNotification: () => void;
  testNotification: () => void;
};
const SoundContext = createContext<SoundContextValue | null>(null);
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

export const SoundProvider = ({ children }: { children: ReactNode }) => {
  const [notificationsEnabled, setNotificationsState] = useState(() => localStorage.getItem("vb_sound_notifications") !== "false");
  const [musicEnabled, setMusicState] = useState(() => localStorage.getItem("vb_sound_music") !== "false");
  const [volume, setVolumeState] = useState(() => {
    const saved = Number(localStorage.getItem("vb_sound_volume"));
    return Number.isFinite(saved) && saved >= 0 && saved <= 100 ? saved : 35;
  });
  const [audioReady, setAudioReady] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const musicNodesRef = useRef<AudioNode[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noteRef = useRef(0);

  const getContext = useCallback(() => {
    if (contextRef.current) return contextRef.current;
    const AudioCtor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioCtor) return null;
    const ctx = new AudioCtor();
    const master = ctx.createGain();
    master.gain.value = volume / 100;
    master.connect(ctx.destination);
    contextRef.current = ctx;
    masterRef.current = master;
    return ctx;
  }, [volume]);

  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsState(enabled);
    localStorage.setItem("vb_sound_notifications", String(enabled));
  };
  const setMusicEnabled = (enabled: boolean) => {
    setMusicState(enabled);
    localStorage.setItem("vb_sound_music", String(enabled));
  };
  const setVolume = (value: number) => {
    const next = Math.max(0, Math.min(100, value));
    setVolumeState(next);
    localStorage.setItem("vb_sound_volume", String(next));
    if (masterRef.current) masterRef.current.gain.setTargetAtTime(next / 100, contextRef.current?.currentTime ?? 0, 0.04);
  };

  const stopMusic = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    musicNodesRef.current.forEach(node => {
      try { if ("stop" in node && typeof (node as OscillatorNode).stop === "function") (node as OscillatorNode).stop(); } catch {}
      try { node.disconnect(); } catch {}
    });
    musicNodesRef.current = [];
  }, []);

  const startMusic = useCallback((ctx: AudioContext) => {
    stopMusic();
    const master = masterRef.current;
    if (!master) return;
    // Original synthesized ambient loop: warm drone, pentatonic plucks and soft rhythmic pulses.
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = "sine";
    drone.frequency.value = 110;
    droneGain.gain.value = 0.045;
    drone.connect(droneGain); droneGain.connect(master); drone.start();
    const fifth = ctx.createOscillator();
    const fifthGain = ctx.createGain();
    fifth.type = "triangle";
    fifth.frequency.value = 164.81;
    fifthGain.gain.value = 0.018;
    fifth.connect(fifthGain); fifthGain.connect(master); fifth.start();
    musicNodesRef.current = [drone, droneGain, fifth, fifthGain];
    const notes = [220, 261.63, 329.63, 392, 329.63, 293.66, 261.63, 196];
    const playNote = () => {
      if (ctx.state !== "running" || !musicEnabled) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = "sine";
      osc.frequency.value = notes[noteRef.current % notes.length];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      osc.connect(gain); gain.connect(master);
      osc.start(now); osc.stop(now + 1.15);
      musicNodesRef.current.push(osc, gain);
      if (musicNodesRef.current.length > 32) musicNodesRef.current.splice(4, 4);
      noteRef.current += 1;
    };
    playNote();
    intervalRef.current = setInterval(playNote, 850);
  }, [musicEnabled, stopMusic]);

  const enableAudio = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    void ctx.resume().then(() => {
      setAudioReady(true);
      if (musicEnabled) startMusic(ctx);
      else stopMusic();
    }).catch(() => setAudioReady(false));
  }, [getContext, musicEnabled, startMusic, stopMusic]);

  const playNotification = useCallback(() => {
    if (!notificationsEnabled || !audioReady) return;
    const ctx = contextRef.current;
    const master = masterRef.current;
    if (!ctx || !master || ctx.state !== "running") return;
    [880, 1174.66].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime + index * 0.09;
      osc.type = "sine"; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      osc.connect(gain); gain.connect(master); osc.start(now); osc.stop(now + 0.2);
    });
  }, [audioReady, notificationsEnabled]);

  const testNotification = useCallback(() => {
    if (!notificationsEnabled) return;
    const ctx = getContext();
    if (!ctx) return;
    void ctx.resume().then(() => {
      setAudioReady(true);
      const master = masterRef.current;
      if (!master) return;
      [880, 1174.66].forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime + index * 0.09;
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 0.2);
      });
    }).catch(() => setAudioReady(false));
  }, [getContext, notificationsEnabled]);

  useEffect(() => {
    if (masterRef.current && contextRef.current) {
      masterRef.current.gain.setTargetAtTime(volume / 100, contextRef.current.currentTime, 0.04);
    }
  }, [volume]);
  useEffect(() => {
    if (!audioReady || !contextRef.current) return;
    if (musicEnabled) startMusic(contextRef.current);
    else stopMusic();
  }, [audioReady, musicEnabled, startMusic, stopMusic]);
  useEffect(() => () => {
    stopMusic();
    void contextRef.current?.close();
  }, [stopMusic]);

  return <SoundContext.Provider value={{ notificationsEnabled, setNotificationsEnabled, musicEnabled, setMusicEnabled, volume, setVolume, audioReady, enableAudio, playNotification, testNotification }}>{children}</SoundContext.Provider>;
};

export const useSound = () => {
  const value = useContext(SoundContext);
  if (!value) throw new Error("useSound deve ser usado dentro de SoundProvider");
  return value;
};
