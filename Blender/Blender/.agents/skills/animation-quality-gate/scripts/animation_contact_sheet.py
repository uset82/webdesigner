#!/usr/bin/env python3
"""Build a contact sheet and animation quality report from rendered frames.

Hard gates (mascot / avatar style):
- silhouette stability (alpha or luminance mask IoU)
- frame-to-frame flicker / jump
- subject dominance (center mass stays in frame center band)
- optional strict mode fails the process when warnings exceed thresholds
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageStat


def luminance_mask(img: Image.Image, threshold: int = 18) -> Image.Image:
    gray = img.convert("L")
    return gray.point(lambda value: 255 if value > threshold else 0, mode="1")


def alpha_mask(img: Image.Image) -> Image.Image | None:
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        alpha = img.convert("RGBA").getchannel("A")
        return alpha.point(lambda value: 255 if value > 8 else 0, mode="1")
    return None


def mask_iou(a: Image.Image, b: Image.Image) -> float:
    a = a.convert("1").resize(b.size, Image.Resampling.NEAREST)
    b = b.convert("1")
    inter = 0
    union = 0
    for pa, pb in zip(a.getdata(), b.getdata()):
        on_a = pa != 0
        on_b = pb != 0
        if on_a and on_b:
            inter += 1
        if on_a or on_b:
            union += 1
    return 1.0 if union == 0 else inter / union


def subject_center(mask: Image.Image) -> tuple[float, float]:
    width, height = mask.size
    total = 0
    sum_x = 0.0
    sum_y = 0.0
    for index, value in enumerate(mask.getdata()):
        if value == 0:
            continue
        total += 1
        sum_x += index % width
        sum_y += index // width
    if total == 0:
        return 0.5, 0.5
    return sum_x / total / width, sum_y / total / height


def mean_rgb_diff(a: Image.Image, b: Image.Image) -> float:
    resized = b.resize(a.size, Image.Resampling.BILINEAR)
    diff = ImageChops.difference(a.convert("RGB"), resized.convert("RGB"))
    return sum(ImageStat.Stat(diff).mean) / 3.0


def main() -> None:
    parser = argparse.ArgumentParser(description="Animation contact sheet + quality gate")
    parser.add_argument("--frames", nargs="+", required=True)
    parser.add_argument("--out-image", required=True)
    parser.add_argument("--out-report", required=True)
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--profile", choices=("generic", "mascot"), default="mascot")
    parser.add_argument("--fail-on-warnings", action="store_true")
    parser.add_argument("--max-frame-diff", type=float, default=None)
    parser.add_argument("--min-silhouette-iou", type=float, default=None)
    parser.add_argument("--max-center-drift", type=float, default=None)
    args = parser.parse_args()

    if args.profile == "mascot":
        max_frame_diff = args.max_frame_diff if args.max_frame_diff is not None else 38.0
        min_silhouette_iou = args.min_silhouette_iou if args.min_silhouette_iou is not None else 0.82
        max_center_drift = args.max_center_drift if args.max_center_drift is not None else 0.12
    else:
        max_frame_diff = args.max_frame_diff if args.max_frame_diff is not None else 45.0
        min_silhouette_iou = args.min_silhouette_iou if args.min_silhouette_iou is not None else 0.7
        max_center_drift = args.max_center_drift if args.max_center_drift is not None else 0.18

    frames = [Path(path) for path in args.frames]
    images = [Image.open(path) for path in frames]
    thumbs: list[Image.Image] = []
    frame_diff: list[dict] = []
    silhouette: list[dict] = []
    centers: list[dict] = []
    warnings: list[str] = []

    thumb_w = 320
    thumb_h = 320
    prev_rgb = None
    prev_mask = None
    base_center = None

    for path, image in zip(frames, images):
        rgb = image.convert("RGB")
        mask = alpha_mask(image) or luminance_mask(rgb)
        center_x, center_y = subject_center(mask)
        centers.append(
            {
                "frame": path.name,
                "center_x": round(center_x, 4),
                "center_y": round(center_y, 4),
            }
        )
        if base_center is None:
            base_center = (center_x, center_y)
        else:
            drift = math.hypot(center_x - base_center[0], center_y - base_center[1])
            if drift > max_center_drift:
                warnings.append(
                    f"Subject dominance drift on {path.name}: {drift:.3f} > {max_center_drift:.3f}"
                )

        thumb = rgb.copy()
        thumb.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (thumb_w, thumb_h), (0, 0, 0))
        canvas.paste(thumb, ((thumb_w - thumb.width) // 2, (thumb_h - thumb.height) // 2))
        draw = ImageDraw.Draw(canvas)
        draw.text((8, 8), path.name, fill=(255, 255, 0))
        thumbs.append(canvas)

        if prev_rgb is not None and prev_mask is not None:
            diff = mean_rgb_diff(prev_rgb, rgb)
            iou = mask_iou(prev_mask, mask)
            frame_diff.append(
                {
                    "from": frames[len(frame_diff)].name,
                    "to": path.name,
                    "mean_rgb_diff": round(diff, 3),
                }
            )
            silhouette.append(
                {
                    "from": frames[len(silhouette)].name,
                    "to": path.name,
                    "iou": round(iou, 4),
                }
            )
            if diff > max_frame_diff:
                warnings.append(
                    f"High frame-to-frame visual jump {diff:.2f} between "
                    f"{frames[len(frame_diff) - 1].name} and {path.name} (max {max_frame_diff:.2f})"
                )
            if iou < min_silhouette_iou:
                warnings.append(
                    f"Silhouette unstable IoU {iou:.3f} between "
                    f"{frames[len(silhouette) - 1].name} and {path.name} (min {min_silhouette_iou:.3f})"
                )

        prev_rgb = rgb
        prev_mask = mask

    cols = max(1, args.cols)
    rows = math.ceil(len(thumbs) / cols) or 1
    sheet = Image.new("RGB", (cols * thumb_w, rows * thumb_h), (0, 0, 0))
    for index, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((index % cols) * thumb_w, (index // cols) * thumb_h))

    out_image = Path(args.out_image)
    out_report = Path(args.out_report)
    out_image.parent.mkdir(parents=True, exist_ok=True)
    out_report.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_image)

    report = {
        "schema": "animation_contact_sheet_report.v2",
        "profile": args.profile,
        "frames": [str(path) for path in frames],
        "frame_diff": frame_diff,
        "silhouette_iou": silhouette,
        "subject_centers": centers,
        "thresholds": {
            "max_frame_diff": max_frame_diff,
            "min_silhouette_iou": min_silhouette_iou,
            "max_center_drift": max_center_drift,
        },
        "warnings": warnings,
        "passed": len(warnings) == 0,
        "dimensions": [
            "subject_dominance",
            "silhouette_stability",
            "texture_coherence",
            "frame_aesthetics",
        ],
    }
    out_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    summary = {
        "frames": len(frames),
        "warnings": len(warnings),
        "passed": report["passed"],
        "sheet": str(out_image),
        "report": str(out_report),
    }
    print(json.dumps(summary, indent=2))
    if args.fail_on_warnings and warnings:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
