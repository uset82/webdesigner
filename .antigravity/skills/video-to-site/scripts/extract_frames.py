#!/usr/bin/env python3
"""
Video Frame Extractor Helper Script for video-to-site skill.
Converts video files (MP4, MOV, WebM) into zero-padded image sequences (frame_0001.jpg) for canvas scroll animations.
"""

import argparse
import os
import subprocess
import sys

def extract_frames_ffmpeg(input_video, output_dir, fps=30, max_frames=120, quality=3):
    if not os.path.exists(input_video):
        print(f"Error: Input video file '{input_video}' not found.")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    out_pattern = os.path.join(output_dir, "frame_%04d.jpg")

    vf_filter = f"fps={fps},scale=1920:-1"
    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_video,
        "-vf", vf_filter,
        "-vframes", str(max_frames),
        "-q:v", str(quality),
        out_pattern
    ]

    print(f"Extracting up to {max_frames} frames from '{input_video}' to '{output_dir}'...")
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0:
            extracted = len([f for f in os.listdir(output_dir) if f.startswith("frame_") and f.endswith(".jpg")])
            print(f"Successfully extracted {extracted} frames to {output_dir}.")
        else:
            print("ffmpeg failed:", res.stderr)
            sys.exit(1)
    except FileNotFoundError:
        print("Error: 'ffmpeg' binary not found on system PATH. Please install ffmpeg or place image frames manually.")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Extract image frames from video for web scroll canvas animations.")
    parser.add_argument("--input", "-i", required=True, help="Path to input video file (mp4, mov, webm)")
    parser.add_argument("--output", "-o", default="public/frames", help="Output directory for extracted frames")
    parser.add_argument("--fps", type=int, default=30, help="Target frames per second (default: 30)")
    parser.add_argument("--max-frames", type=int, default=120, help="Maximum frames to extract (default: 120)")
    args = parser.parse_args()

    extract_frames_ffmpeg(args.input, args.output, fps=args.fps, max_frames=args.max_frames)

if __name__ == "__main__":
    main()
