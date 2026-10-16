import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  BookmarkPlus,
  MessageSquare,
  Headphones,
  CheckCircle,
} from 'lucide-react';
import { toPersianDigits } from '../utils/persian.ts';

interface Bookmark {
  time: number;
  note: string;
}

interface AudioWaveformPlayerProps {
  url?: string;
  ticketOrId?: string;
  onBookmarkAdd?: (time: number, note: string) => void;
}

export const AudioWaveformPlayer: React.FC<AudioWaveformPlayerProps> = ({
  url,
  ticketOrId,
  onBookmarkAdd,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(148); // 2:28
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarkInput, setBookmarkInput] = useState('');
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // Generate dual-channel stereo style waveform bars (Channel 1: Agent, Channel 2: Vendor)
  const channelAgent = useRef(
    Array.from({ length: 48 }, (_, i) => Math.max(15, Math.sin(i * 0.4) * 35 + 40 + ((i % 5) * 8)))
  ).current;

  const channelVendor = useRef(
    Array.from({ length: 48 }, (_, i) => Math.max(15, Math.cos(i * 0.35) * 30 + 35 + ((i % 4) * 10)))
  ).current;

  // Synthesize realistic audio hum/tone if network fails
  const startTone = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      if (!oscillatorRef.current) {
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioContextRef.current.currentTime);
        gain.gain.setValueAtTime(isMuted ? 0 : 0.05, audioContextRef.current.currentTime);
        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        osc.start();
        oscillatorRef.current = osc;
      }
    } catch {}
  };

  const stopTone = () => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
    } catch {}
  };

  useEffect(() => {
    if (isPlaying) {
      const interval = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            stopTone();
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackRate);
      timerRef.current = interval;
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      stopTone();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopTone();
    };
  }, [isPlaying, duration, playbackRate]);

  const togglePlay = () => {
    if (audioRef.current && url) {
      if (isPlaying) {
        audioRef.current.pause();
        stopTone();
      } else {
        audioRef.current
          .play()
          .catch(() => {
            startTone();
          });
      }
    } else {
      if (!isPlaying) startTone();
      else stopTone();
    }
    setIsPlaying(!isPlaying);
  };

  const jump = (seconds: number) => {
    const nextTime = Math.max(0, Math.min(duration, currentTime + seconds));
    setCurrentTime(nextTime);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const addBookmark = () => {
    if (!bookmarkInput.trim()) return;
    const bm: Bookmark = {
      time: currentTime,
      note: bookmarkInput.trim(),
    };
    setBookmarks((prev) => [...prev, bm]);
    if (onBookmarkAdd) onBookmarkAdd(bm.time, bm.note);
    setBookmarkInput('');
    setShowBookmarkInput(false);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const mm = m < 10 ? `۰${toPersianDigits(m)}` : toPersianDigits(m);
    const ss = s < 10 ? `۰${toPersianDigits(s)}` : toPersianDigits(s);
    return `${mm}:${ss}`;
  };

  const progressPercent = Math.min(100, (currentTime / duration) * 100);

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-800 shadow-md transition-all">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration && !isNaN(a.duration)) {
            setDuration(Math.floor(a.duration));
            setCurrentTime(Math.floor(a.currentTime));
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          stopTone();
        }}
        preload="metadata"
      />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <Headphones className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span>پلیر بازشنوایی مکالمه (Call Audio Inspector)</span>
              {ticketOrId && (
                <span className="text-slate-400 text-[11px] font-mono">({ticketOrId})</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">کانال استریو: صدای کارشناس و وندور</div>
          </div>
        </div>

        {/* Speed presets */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-mono">
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => {
                setPlaybackRate(rate);
                if (audioRef.current) audioRef.current.playbackRate = rate;
              }}
              className={`px-1.5 py-0.5 rounded transition ${
                playbackRate === rate
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {toPersianDigits(rate)}x
            </button>
          ))}
        </div>
      </div>

      {/* Dual Waveform Graphic (Stereo Feel) */}
      <div className="relative bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 mb-3 overflow-hidden">
        {/* Bookmark markers on timeline */}
        {bookmarks.map((bm, idx) => {
          const leftPercent = (bm.time / duration) * 100;
          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 cursor-pointer"
              style={{ left: `${leftPercent}%` }}
              title={`یادداشت در ${formatSeconds(bm.time)}: ${bm.note}`}
              onClick={() => {
                setCurrentTime(bm.time);
                if (audioRef.current) audioRef.current.currentTime = bm.time;
              }}
            >
              <div className="w-2 h-2 rounded-full bg-amber-400 -translate-x-[3px] -translate-y-1 shadow-xs" />
            </div>
          );
        })}

        {/* Channel 1: Agent */}
        <div className="flex items-center justify-between gap-0.5 h-6 mb-1">
          {channelAgent.map((h, i) => {
            const barPercent = (i / channelAgent.length) * 100;
            const isPassed = barPercent <= progressPercent;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-100 ${
                  isPassed ? 'bg-sky-400' : 'bg-slate-700'
                } ${isPlaying && isPassed ? 'scale-y-125' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>

        {/* Center Divider Line */}
        <div className="w-full h-px bg-slate-800/80 my-0.5" />

        {/* Channel 2: Vendor */}
        <div className="flex items-center justify-between gap-0.5 h-6">
          {channelVendor.map((h, i) => {
            const barPercent = (i / channelVendor.length) * 100;
            const isPassed = barPercent <= progressPercent;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-100 ${
                  isPassed ? 'bg-emerald-400' : 'bg-slate-700'
                } ${isPlaying && isPassed ? 'scale-y-125' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Scrubber slider */}
      <input
        type="range"
        min={0}
        max={duration}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 mb-3"
      />

      {/* Control Buttons Bar */}
      <div className="flex items-center justify-between text-xs">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => jump(-5)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="۵ ثانیه عقب"
          >
            <Rewind className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center transition shadow-lg shadow-sky-600/30 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 mr-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => jump(5)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="۵ ثانیه جلو"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono tabular-nums text-slate-300 text-[11px] mr-1">
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
          </span>
        </div>

        {/* Right actions: Bookmark & Volume */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBookmarkInput(!showBookmarkInput)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition"
            title="ثبت یادداشت روی این ثانیه"
          >
            <BookmarkPlus className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">نشانه‌گذاری</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 text-slate-400 hover:text-white"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Bookmark Input Drawer */}
      {showBookmarkInput && (
        <div className="mt-3 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center gap-2">
          <span className="text-[11px] text-amber-400 font-mono shrink-0">
            [{formatSeconds(currentTime)}]
          </span>
          <input
            type="text"
            placeholder="یادداشت ثانیه (مثال: سکوت بیش از حد، خطای اسکریپت...)"
            value={bookmarkInput}
            onChange={(e) => setBookmarkInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBookmark()}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={addBookmark}
            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold"
          >
            ثبت
          </button>
        </div>
      )}

      {/* Logged Bookmarks List */}
      {bookmarks.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
          <span className="text-[10px] text-slate-500 block">نشانه‌های ثبت‌شده در صوت:</span>
          <div className="flex flex-wrap gap-1.5">
            {bookmarks.map((bm, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setCurrentTime(bm.time);
                  if (audioRef.current) audioRef.current.currentTime = bm.time;
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 transition"
              >
                <span className="text-amber-400 font-mono">{formatSeconds(bm.time)}</span>
                <span>{bm.note}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
