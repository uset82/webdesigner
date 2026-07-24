# Video-to-Site Architecture & Reference (videotoside)

This guide documents the complete technical pipeline for transforming video assets into interactive, scroll-driven web animations and web application interfaces.

---

## 1. Video Pre-Processing & Encoding Strategy

### Input Formats
- Supported source formats: `.mp4`, `.mov`, `.webm`, `.avi`
- Recommended codecs: H.264, ProRes, VP9, or AV1

### Extraction Methods

#### Method A: Image Sequence Extraction (Recommended for Scroll Scrubbing)
Convert video frames to an image sequence (`frame_0001.jpg` ... `frame_0120.jpg`):

```bash
# High Quality JPG (82% quality, 30 fps)
ffmpeg -i input.mp4 -vf "fps=30,scale=1920:-1" -q:v 3 public/frames/frame_%04d.jpg

# WebP for smaller bundle size (recommended for mobile)
ffmpeg -i input.mp4 -vf "fps=30,scale=1280:-1" -c:v libwebp -quality 80 public/frames/frame_%04d.webp
```

#### Method B: Direct `<video>` Element Scrubbing (Keyframe-Dense MP4)
If extracting image files is undesirable, re-encode the MP4 with keyframes at every single frame (`keyint=1` or `g=1`):

```bash
ffmpeg -i input.mp4 -vcodec libx264 -g 1 -crf 18 -pix_fmt yuv420p public/hero-keyframed.mp4
```

*Note:* Setting keyframe interval (`-g 1`) allows real-time smooth scrubbing via `videoElement.currentTime` without video decoder lag.

---

## 2. Frame Budgeting & Memory Limits

| Screen Size | Resolution | Total Frames | Approx Memory Footprint |
|-------------|------------|--------------|--------------------------|
| Desktop (Large) | 1920×1080 | 120 frames | ~18–25 MB RAM |
| Desktop (Medium)| 1440×810  | 96 frames  | ~12–15 MB RAM |
| Mobile      | 960×540   | 72 frames  | ~4–6 MB RAM |

---

## 3. Responsive Mobile Adjustments

1. **Mobile Zoom Factor**: Apply a 1.3x scale factor to canvas `drawImage` on viewport widths `<768px` so video subjects remain prominent on mobile displays.
2. **Reduced Section Scroll Height**: Decrease outer section scroll height from `400vh` on desktop to `300vh` on mobile to shorten required scroll effort.
3. **Preload Overlay**: Always display a loading bar that reflects `loadedFrames / totalFrames` to prevent blank canvas states.

---

## 4. Troubleshooting & Performance Checklist

- [ ] Video keyframes set to 1 if scrubbing `<video>` directly
- [ ] Frames zero-padded with `%04d` format (`frame_0001.jpg`)
- [ ] Passive scroll event listeners enabled
- [ ] `requestAnimationFrame` with `tickingRef` used for frame drawing
- [ ] Device Pixel Ratio (`devicePixelRatio`) scaling applied to canvas internal resolution
