import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AvatarManifest, AvatarPoseInput, AvatarState, AvatarTrigger } from "../bridge/messages";
import "./LayeredMascotRenderer.css";

export const LAYERED_MASCOT_MANIFEST_ID = "skjermbilde-character";

export type LayeredMascotRendererProps = {
  state: AvatarState;
  poseInput: AvatarPoseInput;
  reducedMotion: boolean;
  intensity: "low" | "medium" | "high";
  focusMode: boolean;
  lipSyncEnabled: boolean;
  triggerEvent: { trigger: AvatarTrigger; sequence: number } | null;
};

type MascotCssProperties = CSSProperties & {
  "--mascot-look-x": string;
  "--mascot-look-y": string;
  "--mascot-head-x": string;
  "--mascot-head-y": string;
  "--mascot-head-rotate": string;
  "--mascot-mouth-open": string;
};

export function shouldUseLayeredMascot(manifest: Pick<AvatarManifest, "id">): boolean {
  return manifest.id.trim().toLocaleLowerCase() === LAYERED_MASCOT_MANIFEST_ID;
}

export function getLayeredMascotStyle(
  state: AvatarState,
  poseInput: AvatarPoseInput,
  lipSyncEnabled: boolean,
  reducedMotion: boolean
): MascotCssProperties {
  const cursorX = clamp(poseInput.cursorX ?? 0.5, 0, 1);
  const cursorY = clamp(poseInput.cursorY ?? 0.5, 0, 1);
  const gazeScale = reducedMotion ? 0.45 : 1;
  const lookX = (cursorX - 0.5) * 12 * gazeScale;
  const lookY = (cursorY - 0.5) * 8 * gazeScale;
  const isSpeaking = state === "speaking";
  const suppliedMouth = lipSyncEnabled ? clamp(poseInput.mouthOpen ?? 0, 0, 1) : 0;
  const mouthOpen = isSpeaking ? Math.max(0.2, suppliedMouth) : suppliedMouth;

  return {
    "--mascot-look-x": `${lookX.toFixed(2)}px`,
    "--mascot-look-y": `${lookY.toFixed(2)}px`,
    "--mascot-head-x": `${((cursorX - 0.5) * 4 * gazeScale).toFixed(2)}px`,
    "--mascot-head-y": `${((cursorY - 0.5) * 2.5 * gazeScale).toFixed(2)}px`,
    "--mascot-head-rotate": `${((cursorX - 0.5) * 2.4 * gazeScale).toFixed(2)}deg`,
    "--mascot-mouth-open": (0.6 + mouthOpen * 0.9).toFixed(2)
  };
}

/**
 * A code-native, named-layer SVG reconstruction of the supplied character.
 * It never injects SVG markup and can therefore run under the Webview's strict CSP.
 */
export function LayeredMascotRenderer({
  state,
  poseInput,
  reducedMotion,
  intensity,
  focusMode,
  lipSyncEnabled,
  triggerEvent
}: LayeredMascotRendererProps) {
  const [naturalBlink, setNaturalBlink] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<AvatarTrigger | null>(null);
  const style = useMemo(
    () => getLayeredMascotStyle(state, poseInput, lipSyncEnabled, reducedMotion),
    [lipSyncEnabled, poseInput, reducedMotion, state]
  );

  useEffect(() => {
    if (reducedMotion || state === "sleeping") {
      setNaturalBlink(false);
      return;
    }

    let blinkTimer: ReturnType<typeof setTimeout> | undefined;
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleBlink = () => {
      blinkTimer = setTimeout(
        () => {
          setNaturalBlink(true);
          reopenTimer = setTimeout(() => {
            setNaturalBlink(false);
            scheduleBlink();
          }, 125);
        },
        2400 + Math.round(Math.random() * 3300)
      );
    };

    scheduleBlink();
    return () => {
      if (blinkTimer) clearTimeout(blinkTimer);
      if (reopenTimer) clearTimeout(reopenTimer);
    };
  }, [reducedMotion, state]);

  useEffect(() => {
    if (!triggerEvent) return;
    setActiveTrigger(triggerEvent.trigger);
    const triggerTimer = setTimeout(() => setActiveTrigger(null), triggerDuration(triggerEvent.trigger));
    return () => clearTimeout(triggerTimer);
  }, [triggerEvent]);

  const blinking = naturalBlink || activeTrigger === "blink" || state === "sleeping";

  return (
    <div
      className="avatar-shell layered-mascot-shell"
      data-avatar-source="layered-mascot"
      data-avatar-state={state}
      data-reduced-motion={String(reducedMotion)}
      data-intensity={intensity}
      data-focus-mode={String(focusMode)}
      data-blinking={String(blinking)}
      data-trigger={activeTrigger ?? "none"}
      style={style}
      aria-hidden="true"
    >
      <svg className="layered-mascot" viewBox="0 0 441 653" role="img">
        <title>Animated Cholita mascot</title>
        <defs>
          <linearGradient id="mascot-skirt" x1="220" y1="400" x2="220" y2="620" gradientUnits="userSpaceOnUse">
            <stop stopColor="#222226" />
            <stop offset="0.55" stopColor="#121215" />
            <stop offset="1" stopColor="#050506" />
          </linearGradient>
          <linearGradient id="mascot-hair" x1="220" y1="150" x2="220" y2="350" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1c1c1f" />
            <stop offset="1" stopColor="#050506" />
          </linearGradient>
          <radialGradient id="mascot-eye-fill" cx="42%" cy="38%" r="62%">
            <stop stopColor="#5a5a5e" />
            <stop offset="0.45" stopColor="#2a2a2e" />
            <stop offset="1" stopColor="#050506" />
          </radialGradient>
          <radialGradient id="mascot-cheek" cx="50%" cy="50%" r="50%">
            <stop stopColor="#ff8fb3" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ff8fb3" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mascot-hat-brim" x1="220" y1="120" x2="220" y2="175" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4a4648" />
            <stop offset="0.45" stopColor="#2e2b2d" />
            <stop offset="1" stopColor="#1a1819" />
          </linearGradient>
          <pattern id="mascot-weave" width="14" height="22" patternUnits="userSpaceOnUse">
            <rect width="14" height="22" fill="#1a1a1d" />
            <rect width="1.4" height="22" x="0" fill="#e11d2e" />
            <rect width="1.4" height="22" x="1.6" fill="#f97316" />
            <rect width="1.4" height="22" x="3.2" fill="#facc15" />
            <rect width="1.4" height="22" x="4.8" fill="#84cc16" />
            <rect width="1.4" height="22" x="6.4" fill="#22c55e" />
            <rect width="1.4" height="22" x="8" fill="#06b6d4" />
            <rect width="1.4" height="22" x="9.6" fill="#3b82f6" />
            <rect width="1.4" height="22" x="11.2" fill="#8b5cf6" />
            <rect width="1.2" height="22" x="12.8" fill="#ec4899" />
          </pattern>
          <filter id="mascot-shadow" x="-30%" y="-30%" width="160%" height="180%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="mascot-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <clipPath id="mascot-left-eye-clip">
            <ellipse cx="160" cy="288" rx="34" ry="40" />
          </clipPath>
          <clipPath id="mascot-right-eye-clip">
            <ellipse cx="282" cy="288" rx="34" ry="40" />
          </clipPath>
          <clipPath id="mascot-scarf-clip">
            <path d="M114 332c26-34 188-34 214 0l-6 80c-62 36-140 36-202 0l-6-80Z" />
          </clipPath>
        </defs>

        <g id="avatar/root" data-layer="avatar/root">
          <g id="avatar/shadow" data-layer="avatar/shadow">
            <ellipse className="mascot-ground-shadow" cx="220" cy="630" rx="138" ry="15" />
          </g>

          <g id="avatar/body" data-layer="avatar/body" className="mascot-body-rig">
            <g
              id="avatar/feet"
              data-layer="avatar/feet"
              className="mascot-feet"
              stroke="#09090b"
              strokeWidth="5.5"
              strokeLinejoin="round"
            >
              <path fill="#f3a66f" d="M166 588c20-5 40 1 48 14l-10 38c-24 13-44 4-52-13l14-39Z" />
              <path fill="#f3a66f" d="M275 588c-20-5-40 1-48 14l10 38c24 13 44 4 52-13l-14-39Z" />
              <path fill="#111113" d="M160 604c18-9 36-8 50 2l-5 16c-16-8-33-8-50-1l5-17Z" />
              <path fill="#111113" d="M281 604c-18-9-36-8-50 2l5 16c16-8 33-8 50-1l-5-17Z" />
            </g>

            <g id="avatar/skirt" data-layer="avatar/skirt" className="mascot-skirt">
              <path
                fill="url(#mascot-skirt)"
                stroke="#09090b"
                strokeWidth="7"
                strokeLinejoin="round"
                d="M108 402c40-24 186-24 226 0 9 60 28 122 78 168-30 36-112 54-191 55-79-1-161-19-191-55 50-46 69-108 78-168Z"
              />
              <path
                className="mascot-skirt-trim mascot-skirt-trim-one"
                d="M84 508c28 18 58 30 92 36 34 6 68 6 102 0 34-6 64-18 92-36"
              />
              <path
                className="mascot-skirt-trim mascot-skirt-trim-two"
                d="M68 540c32 22 66 36 104 42 38 6 76 6 114 0 38-6 72-20 104-42"
              />
            </g>

            <g
              id="avatar/cape"
              data-layer="avatar/cape"
              className="mascot-cape"
              stroke="#0b0b0d"
              strokeWidth="6.5"
              strokeLinejoin="round"
            >
              <path fill="#f10d18" d="M104 368c-32 32-44 74-46 134 48-30 88-56 124-94l-78-40Z" />
              <path fill="#f10d18" d="M337 368c32 32 44 74 46 134-48-30-88-56-124-94l78-40Z" />
              <path fill="#f10d18" d="M136 362c32 24 138 24 170 0l-18 104H154l-18-104Z" />
              <path fill="#ffffff" d="M76 424c26-5 54 1 74 16l-32 38c-20-10-36-28-42-54Z" />
              <path fill="#ffffff" d="M365 424c-26-5-54 1-74 16l32 38c20-10 36-28 42-54Z" />
              <path fill="#d40a14" d="M190 406c-9 28-20 54-36 78 28 6 46 0 66-20l-30-58Z" />
              <path fill="#d40a14" d="M251 406c9 28 20 54 36 78-28 6-46 0-66-20l30-58Z" />
            </g>

            <g
              id="avatar/hands"
              data-layer="avatar/hands"
              className="mascot-hands"
              fill="#f3a66f"
              stroke="#0b0b0d"
              strokeWidth="5.5"
              strokeLinejoin="round"
            >
              <path d="M74 428c-22-5-36 3-35 18 1 15 21 22 40 15 9 14 30 14 38 2-13-5-20-15-19-27-8-5-16-7-24-8Z" />
              <path d="M367 428c22-5 36 3 35 18-1 15-21 22-40 15-9 14-30 14-38 2 13-5 20-15 19-27 8-5 16-7 24-8Z" />
            </g>

            <g
              id="avatar/scarf"
              data-layer="avatar/scarf"
              className="mascot-scarf"
              stroke="#101014"
              strokeWidth="6"
              strokeLinejoin="round"
            >
              <path fill="#141417" d="M114 332c26-34 188-34 214 0l-6 80c-62 36-140 36-202 0l-6-80Z" />
              <g clipPath="url(#mascot-scarf-clip)">
                <path fill="url(#mascot-weave)" d="M100 300h250v140H100z" />
              </g>
              <path
                fill="none"
                stroke="#101014"
                strokeWidth="6"
                d="M114 332c26-34 188-34 214 0l-6 80c-62 36-140 36-202 0l-6-80Z"
              />
              <path fill="#f10d18" stroke="#101014" strokeWidth="5" d="M176 370h90l-45 70-45-70Z" />
            </g>

            <g id="avatar/medallion" data-layer="avatar/medallion" className="mascot-medallion">
              <circle cx="221" cy="420" r="29" fill="#f8fafc" stroke="#16161a" strokeWidth="5.5" />
              <circle cx="221" cy="420" r="21" fill="#86efac" />
              <circle cx="221" cy="420" r="17" fill="#f0fdf4" />
              {/* Tiny people figures matching the pin illustration */}
              <ellipse cx="208" cy="414" rx="3.2" ry="3.8" fill="#f9a8d4" />
              <path d="M204 418h8v8h-8z" fill="#60a5fa" />
              <ellipse cx="221" cy="412" rx="3.4" ry="4" fill="#fde68a" />
              <path d="M217 416h8v9h-8z" fill="#fb923c" />
              <ellipse cx="234" cy="414" rx="3.2" ry="3.8" fill="#c4b5fd" />
              <path d="M230 418h8v8h-8z" fill="#34d399" />
              <ellipse cx="214" cy="426" rx="2.6" ry="3" fill="#fda4af" />
              <path d="M211 429h6v6h-6z" fill="#38bdf8" />
              <ellipse cx="228" cy="426" rx="2.6" ry="3" fill="#a5b4fc" />
              <path d="M225 429h6v6h-6z" fill="#f472b6" />
            </g>
          </g>

          <g id="avatar/head" data-layer="avatar/head" className="mascot-head-rig">
            <g
              id="avatar/hair/back"
              data-layer="avatar/hair/back"
              fill="url(#mascot-hair)"
              stroke="#09090b"
              strokeWidth="7"
              strokeLinejoin="round"
            >
              <path d="M98 158c22-54 224-54 246 0 34 72 40 146-4 172l-32-64H134l-32 64c-44-26-38-100-4-172Z" />
            </g>

            <g id="avatar/ears" data-layer="avatar/ears" fill="#f3a66f" stroke="#111113" strokeWidth="5.5">
              <ellipse cx="100" cy="292" rx="23" ry="31" />
              <ellipse cx="342" cy="292" rx="23" ry="31" />
            </g>

            <g id="avatar/face" data-layer="avatar/face">
              <path
                className="mascot-face"
                fill="#f3a66f"
                stroke="#111113"
                strokeWidth="7"
                d="M108 232c10-68 216-68 226 0v56c0 68-48 110-113 110S108 356 108 288v-56Z"
              />
              <path d="M118 236c40-8 206-8 246 0" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="10" />
            </g>

            <g
              id="avatar/hair/front"
              data-layer="avatar/hair/front"
              className="mascot-hair-front"
              fill="#0a0a0c"
              stroke="#0a0a0c"
              strokeLinejoin="round"
            >
              <path d="M108 240c8-62 38-96 86-104-18 36-4 68 22 84-42-4-70 6-108 20Z" />
              <path d="M334 240c-8-62-38-96-86-104 18 36 4 68-22 84 42-4 70 6 108 20Z" />
              <path d="M168 168c18-14 40-20 54-20 14 0 36 6 54 20-16 22-28 46-38 70-10-24-22-48-38-70Z" />
              <path d="M198 166c14-4 28-4 46 0-8 18-14 36-18 54-4-18-10-36-18-54Z" fill="#050506" />
            </g>

            <g
              id="avatar/eyebrows"
              data-layer="avatar/eyebrows"
              className="mascot-brows"
              fill="none"
              stroke="#171719"
              strokeWidth="6"
              strokeLinecap="round"
            >
              <path className="mascot-brow-left" d="M126 238c22-16 44-16 64-4" />
              <path className="mascot-brow-right" d="M252 234c20-12 42-12 64 4" />
            </g>

            <g id="avatar/eyes" data-layer="avatar/eyes" className="mascot-eyes">
              <g id="avatar/eyes/left" data-layer="avatar/eyes/left" className="mascot-eye mascot-eye-left">
                <ellipse cx="160" cy="288" rx="36" ry="42" fill="#ffffff" stroke="#151519" strokeWidth="6" />
                <g className="mascot-iris" clipPath="url(#mascot-left-eye-clip)">
                  <ellipse cx="160" cy="292" rx="27" ry="33" fill="url(#mascot-eye-fill)" />
                  <ellipse cx="160" cy="298" rx="17" ry="23" fill="#050506" />
                  <ellipse cx="148" cy="276" rx="10" ry="13" fill="#ffffff" />
                  <circle cx="172" cy="286" r="5" fill="#ffffff" />
                  <circle cx="156" cy="304" r="3.5" fill="#ffffff" opacity="0.9" />
                </g>
                <g fill="none" stroke="#101014" strokeWidth="5" strokeLinecap="round">
                  <path d="M126 258c-10-10-14-18-14-28" />
                  <path d="M130 252c-4-12-2-22 2-30" />
                  <path d="M138 246c4-12 10-20 18-26" />
                </g>
              </g>
              <g id="avatar/eyes/right" data-layer="avatar/eyes/right" className="mascot-eye mascot-eye-right">
                <ellipse cx="282" cy="288" rx="36" ry="42" fill="#ffffff" stroke="#151519" strokeWidth="6" />
                <g className="mascot-iris" clipPath="url(#mascot-right-eye-clip)">
                  <ellipse cx="282" cy="292" rx="27" ry="33" fill="url(#mascot-eye-fill)" />
                  <ellipse cx="282" cy="298" rx="17" ry="23" fill="#050506" />
                  <ellipse cx="270" cy="276" rx="10" ry="13" fill="#ffffff" />
                  <circle cx="294" cy="286" r="5" fill="#ffffff" />
                  <circle cx="278" cy="304" r="3.5" fill="#ffffff" opacity="0.9" />
                </g>
                <g fill="none" stroke="#101014" strokeWidth="5" strokeLinecap="round">
                  <path d="M316 258c10-10 14-18 14-28" />
                  <path d="M312 252c4-12 2-22-2-30" />
                  <path d="M304 246c-4-12-10-20-18-26" />
                </g>
              </g>
              <g
                id="avatar/eyelids"
                data-layer="avatar/eyelids"
                className="mascot-eyelids"
                fill="none"
                stroke="#171719"
                strokeWidth="7"
                strokeLinecap="round"
              >
                <path d="M126 288c22 18 46 18 68 0" />
                <path d="M248 288c22 18 46 18 68 0" />
              </g>
            </g>

            <g id="avatar/cheeks" data-layer="avatar/cheeks" className="mascot-cheeks">
              <ellipse cx="152" cy="336" rx="24" ry="16" fill="url(#mascot-cheek)" filter="url(#mascot-soft)" />
              <ellipse cx="290" cy="336" rx="24" ry="16" fill="url(#mascot-cheek)" filter="url(#mascot-soft)" />
            </g>

            <g id="avatar/mouth" data-layer="avatar/mouth" className="mascot-mouth">
              <g className="mascot-mouth-smile">
                <path
                  d="M188 336c20 10 46 10 66 0-6 32-56 42-66 0Z"
                  fill="#1a0a0c"
                  stroke="#171719"
                  strokeWidth="5"
                  strokeLinejoin="round"
                />
                <path d="M194 338h54v11c-10 5-20 7-27 7s-17-2-27-7v-11Z" fill="#ffffff" />
                <path d="M200 338v11M211 338v11M222 338v11M233 338v11" stroke="#d4d4d8" strokeWidth="1.5" />
                <path d="M200 356c14-8 28-8 42 0" fill="none" stroke="#e11d48" strokeWidth="7" strokeLinecap="round" />
              </g>
              <g className="mascot-mouth-open">
                <ellipse cx="221" cy="350" rx="26" ry="20" fill="#1a0a0c" stroke="#171719" strokeWidth="4" />
                <path d="M202 340h38v9c-7 4-16 5-19 5s-12-1-19-5v-9Z" fill="#ffffff" />
                <path d="M203 356c12-8 24-8 36 0" stroke="#e11d48" strokeWidth="8" strokeLinecap="round" />
              </g>
              <path
                className="mascot-mouth-concerned"
                d="M200 356c16-16 30-16 44 0"
                fill="none"
                stroke="#171719"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </g>

            <g
              id="avatar/hat"
              data-layer="avatar/hat"
              className="mascot-hat"
              stroke="#09090b"
              strokeWidth="7"
              strokeLinejoin="round"
            >
              <path fill="#050506" d="M96 146 93 72C91 24 136-4 221-4s130 28 128 76l-3 74H96Z" />
              <path
                fill="url(#mascot-hat-brim)"
                d="M84 132c46 18 228 18 274 0 26 0 34 14 28 34-7 26-32 28-64 30H120c-32-2-57-4-64-30-6-20 2-34 28-34Z"
              />
              <path d="M110 148c36 8 186 8 222 0" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="8" />
            </g>
          </g>

          <g
            id="avatar/reactions"
            data-layer="avatar/reactions"
            className="mascot-reactions"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g className="mascot-thinking-effect" fill="#ffffff" stroke="#273244" strokeWidth="5">
              <circle cx="351" cy="248" r="8" />
              <circle cx="371" cy="223" r="12" />
              <path d="M386 188h24M398 176v24" />
            </g>
            <g className="mascot-success-effect" fill="none" stroke="#22c55e" strokeWidth="9">
              <path d="m344 249 17 17 34-43" />
              <path className="mascot-spark mascot-spark-one" d="M71 240v25M59 252h24" stroke="#facc15" />
              <path className="mascot-spark mascot-spark-two" d="M365 314v24M353 326h24" stroke="#60a5fa" />
            </g>
            <g className="mascot-error-effect" fill="none" stroke="#ef3340" strokeWidth="10">
              <path d="m359 222 37 37M396 222l-37 37" />
            </g>
            <g className="mascot-warning-effect" fill="none" stroke="#f59e0b" strokeWidth="9">
              <path d="M377 218v31M377 265h.1" />
            </g>
            <g className="mascot-sleep-effect" fill="none" stroke="#818cf8" strokeWidth="7">
              <path d="M339 250h31l-31 32h31M370 212h22l-22 23h22" />
            </g>
            <g className="mascot-confetti" stroke="none">
              <path fill="#facc15" d="m70 214 7 13 14 2-10 10 2 15-13-7-13 7 2-15-10-10 14-2 7-13Z" />
              <circle cx="383" cy="299" r="9" fill="#22c55e" />
              <path d="m346 184 10 18-20 2 10-20Z" fill="#ef476f" />
            </g>
          </g>
        </g>
      </svg>
      <span className="avatar-presence" aria-hidden="true" />
    </div>
  );
}

function triggerDuration(trigger: AvatarTrigger): number {
  if (trigger === "blink") return 180;
  if (trigger === "look-left" || trigger === "look-right") return 700;
  return 950;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
