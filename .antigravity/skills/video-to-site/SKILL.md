---
name: video-to-site
description: Convert video files (MP4, WebM, MOV) into interactive web scroll animations, sticky canvas frame sequences, background video controllers, or video-to-site experiences. Use when the user requests converting a video into a website animation, extracting frames from a video for scroll scrubbing, building a video-driven hero section, or when TaskIntent includes the video-to-site integration.
---

# Video to Site (Video-Driven Web Animations)

## Contract

- **Stage**: `build`, `design`
- **Reads**: `TaskIntent`, `StackSelection`, video assets (`.mp4`, `.webm`, `.mov`), design artifacts
- **Emits artifacts**: `extracted-frame-manifest`, `canvas-video-controller`, `video-to-site-config`
- **Reference**: [videotoside.md](file:///e:/PROYECTOS/webdesigner/skills/video-to-site/references/videotoside.md)
- **Helper Script**: [scripts/extract_frames.py](file:///e:/PROYECTOS/webdesigner/skills/video-to-site/scripts/extract_frames.py)

## Core Capabilities

1. **Video-to-Frame Extraction**: Convert input video files into compressed, zero-padded JPG/WebP image sequences (`frame_0001.jpg`, `frame_0002.jpg`, ...) at target frame rates (24–30 fps, 90–120 total frames).
2. **Scroll-Driven Canvas Scrubbing**: Synchronize scroll position (`0.0` to `1.0`) with exact video frame playback inside a sticky HTML5 canvas container.
3. **HTML5 Direct Video Scrubbing (Alternative)**: For small compressed MP4s, drive `videoElement.currentTime = progress * videoElement.duration` using `requestAnimationFrame` without extracting static image files.
4. **Performance Hardening**: Hardware GPU acceleration, RAF throttling with `tickingRef`, retina DPR canvas scaling, and image preloading progress overlays.

## Workflow

### 1. Frame Extraction (Command Line or Script)
If the user provides a video file (e.g. `public/hero-video.mp4`):

```bash
# Using ffmpeg directly:
ffmpeg -i public/hero-video.mp4 -vf "fps=30,scale=1920:-1" -q:v 3 public/frames/frame_%04d.jpg

# Or using the included Python helper script:
python skills/video-to-site/scripts/extract_frames.py --input public/hero-video.mp4 --output public/frames --fps 30 --max-frames 120
```

### 2. React / Next.js Scroll Controller Component

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

const FRAME_COUNT = 106;

export default function VideoScrollHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const tickingRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  // Preload frames
  useEffect(() => {
    let loadedCount = 0;
    const imgs: HTMLImageElement[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = `/frames/frame_${String(i).padStart(4, '0')}.jpg`;
      img.onload = () => {
        loadedCount++;
        setProgress(loadedCount / FRAME_COUNT);
        if (loadedCount === FRAME_COUNT) setLoaded(true);
      };
      imgs.push(img);
    }
    framesRef.current = imgs;
  }, []);

  // Scroll handler with RAF throttling
  useEffect(() => {
    if (!loaded) return;

    const handleScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;

      requestAnimationFrame(() => {
        const section = sectionRef.current;
        const canvas = canvasRef.current;
        if (!section || !canvas) {
          tickingRef.current = false;
          return;
        }

        const rect = section.getBoundingClientRect();
        const scrollable = section.offsetHeight - window.innerHeight;
        const scrollProgress = Math.min(1, Math.max(0, -rect.top / scrollable));
        const frameIdx = Math.min(FRAME_COUNT - 1, Math.floor(scrollProgress * FRAME_COUNT));

        const ctx = canvas.getContext('2d');
        const img = framesRef.current[frameIdx];
        if (ctx && img && img.complete) {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = window.innerWidth * dpr;
          canvas.height = window.innerHeight * dpr;

          const imgRatio = img.naturalWidth / img.naturalHeight;
          const canvasRatio = canvas.width / canvas.height;
          let drawW = canvas.width;
          let drawH = canvas.width / imgRatio;

          if (canvasRatio < imgRatio) {
            drawH = canvas.height;
            drawW = canvas.height * imgRatio;
          }

          const drawX = (canvas.width - drawW) / 2;
          const drawY = (canvas.height - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }
        tickingRef.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial render
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loaded]);

  return (
    <section ref={sectionRef} style={{ height: '400vh' }} className="relative">
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black z-50">
            <p className="text-sm font-mono mb-2">Loading video frames... {Math.round(progress * 100)}%</p>
            <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-150" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="h-full w-full object-cover" />
      </div>
    </section>
  );
}
```

## Optimization Rules

1. **Target 96–120 Frames**: A 4-second video clip at 24–30fps yields 96–120 frames, balancing smooth motion with browser memory limits.
2. **JPG vs PNG**: Use JPG (quality 80–85%) for solid video frames; use PNG only when transparent alpha backgrounds are needed.
3. **Direct HTML5 Video Scrubbing**: When static frame extraction is not preferred and video filesize is small (<5MB H.264 keyframe-dense MP4), scrub the `<video>` element directly via `video.currentTime = progress * duration`.
