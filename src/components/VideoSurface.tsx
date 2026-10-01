import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface VideoHandle {
  play(): void;
  pause(): void;
  seek(sec: number): void;
  time(): number;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReady: Promise<void> | null = null;
function loadYouTube(): Promise<void> {
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return ytReady;
}

export function parseYouTubeId(input: string): string {
  if (!input) return '';
  const m = input.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(input.trim()) ? input.trim() : '';
}

/** Unified player for YouTube embeds and plain video files. */
const VideoSurface = forwardRef<VideoHandle, { type: 'youtube' | 'file'; src: string; onTime?: (t: number) => void }>(function VideoSurface({ type, src, onTime }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const yt = useRef<any>(null);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (type !== 'youtube' || !src) return;
    let cancelled = false;
    loadYouTube().then(() => {
      if (cancelled || !host.current) return;
      const el = document.createElement('div');
      host.current.innerHTML = '';
      host.current.appendChild(el);
      yt.current = new window.YT.Player(el, {
        videoId: src,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 0 },
      });
    });
    return () => {
      cancelled = true;
      try {
        yt.current?.destroy();
      } catch {
        /* ignore */
      }
      yt.current = null;
    };
  }, [type, src]);

  useEffect(() => {
    if (!onTime) return;
    const t = window.setInterval(() => {
      const now = type === 'youtube' ? yt.current?.getCurrentTime?.() : vid.current?.currentTime;
      if (typeof now === 'number') onTime(now);
    }, 200);
    return () => window.clearInterval(t);
  }, [type, onTime]);

  useImperativeHandle(ref, () => ({
    play: () => (type === 'youtube' ? yt.current?.playVideo?.() : vid.current?.play()),
    pause: () => (type === 'youtube' ? yt.current?.pauseVideo?.() : vid.current?.pause()),
    seek: (s: number) => {
      if (type === 'youtube') yt.current?.seekTo?.(s, true);
      else if (vid.current) vid.current.currentTime = s;
    },
    time: () => (type === 'youtube' ? yt.current?.getCurrentTime?.() || 0 : vid.current?.currentTime || 0),
  }));

  return <div className="video-surface">{type === 'youtube' ? <div ref={host} className="video-surface__yt" /> : <video ref={vid} src={src} controls playsInline />}</div>;
});

export default VideoSurface;
