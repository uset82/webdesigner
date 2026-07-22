import type { AvatarConfig } from "../bridge/messages";
import { postToExtension } from "../bridge/vscodeApi";

type SettingsPanelProps = {
  config: AvatarConfig;
};

export function SettingsPanel({ config }: SettingsPanelProps) {
  return (
    <section className="settings-panel" aria-labelledby="behavior-settings-heading">
      <header className="settings-heading">
        <div>
          <h2 id="behavior-settings-heading">Behavior</h2>
          <p>Keep the assistant present without getting in your way.</p>
        </div>
      </header>

      <fieldset className="behavior-settings">
        <legend>Everyday behavior</legend>
        <label className="setting-row checkbox-row">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(event) =>
              postToExtension({ type: "settings:update", config: { enabled: event.currentTarget.checked } })
            }
          />
        </label>
        <label className="setting-row checkbox-row">
          <span>Focus mode</span>
          <input
            type="checkbox"
            checked={config.focusMode}
            onChange={(event) =>
              postToExtension({ type: "settings:update", config: { focusMode: event.currentTarget.checked } })
            }
          />
        </label>
        <label className="setting-row">
          <span>Intensity</span>
          <select
            value={config.animationIntensity}
            onChange={(event) =>
              postToExtension({
                type: "settings:update",
                config: { animationIntensity: event.currentTarget.value as AvatarConfig["animationIntensity"] }
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="setting-row checkbox-row">
          <span>Speech bubble</span>
          <input
            type="checkbox"
            checked={config.showSpeechBubble}
            onChange={(event) =>
              postToExtension({ type: "settings:update", config: { showSpeechBubble: event.currentTarget.checked } })
            }
          />
        </label>
        <label className="setting-row checkbox-row">
          <span>Reduced motion</span>
          <input
            type="checkbox"
            checked={config.respectReducedMotion}
            onChange={(event) =>
              postToExtension({
                type: "settings:update",
                config: { respectReducedMotion: event.currentTarget.checked }
              })
            }
          />
        </label>
      </fieldset>

      <details className="advanced-settings">
        <summary>
          <span>Advanced behavior</span>
          <small>Runtime, timing, effects, and diagnostics</small>
        </summary>
        <div className="advanced-settings-grid">
          <label className="setting-row">
            <span>Runtime</span>
            <select
              value={config.runtime === "pixi" || config.runtime === "webgl" ? config.runtime : "svg"}
              onChange={(event) =>
                postToExtension({
                  type: "settings:update",
                  config: { runtime: event.currentTarget.value as AvatarConfig["runtime"] }
                })
              }
            >
              <option value="svg">SVG</option>
              <option value="pixi">PixiJS</option>
              <option value="webgl">WebGL 3D</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Position</span>
            <select
              value={config.position}
              onChange={(event) =>
                postToExtension({
                  type: "settings:update",
                  config: { position: event.currentTarget.value as AvatarConfig["position"] }
                })
              }
            >
              <option value="activity-bar-view">Activity</option>
              <option value="side-panel">Side</option>
              <option value="bottom-right">Right</option>
              <option value="bottom-left">Left</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Frame rate</span>
            <select
              value={config.frameRate}
              onChange={(event) =>
                postToExtension({
                  type: "settings:update",
                  config: { frameRate: Number(event.currentTarget.value) as 30 | 60 }
                })
              }
            >
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
            </select>
          </label>
          <label className="setting-row checkbox-row">
            <span>Particle effects</span>
            <input
              type="checkbox"
              checked={config.particleEffects}
              onChange={(event) =>
                postToExtension({
                  type: "settings:update",
                  config: { particleEffects: event.currentTarget.checked }
                })
              }
            />
          </label>
          <label className="setting-row checkbox-row">
            <span>Sound</span>
            <input
              type="checkbox"
              checked={config.soundEnabled}
              onChange={(event) =>
                postToExtension({ type: "settings:update", config: { soundEnabled: event.currentTarget.checked } })
              }
            />
          </label>
          <label className="setting-row checkbox-row">
            <span>Lip sync</span>
            <input
              type="checkbox"
              checked={config.lipSyncEnabled}
              onChange={(event) =>
                postToExtension({ type: "settings:update", config: { lipSyncEnabled: event.currentTarget.checked } })
              }
            />
          </label>
          <label className="setting-row">
            <span>Idle seconds</span>
            <input
              type="number"
              min={0}
              max={86400}
              value={config.idleTimeout}
              onChange={(event) =>
                postToExtension({
                  type: "settings:update",
                  config: { idleTimeout: Number(event.currentTarget.value) }
                })
              }
            />
          </label>
          <label className="setting-row">
            <span>Sleep seconds</span>
            <input
              type="number"
              min={0}
              max={86400}
              value={config.sleepTimeout}
              onChange={(event) =>
                postToExtension({
                  type: "settings:update",
                  config: { sleepTimeout: Number(event.currentTarget.value) }
                })
              }
            />
          </label>
          <label className="setting-row checkbox-row">
            <span>No animation</span>
            <input
              type="checkbox"
              checked={config.noAnimation}
              onChange={(event) =>
                postToExtension({ type: "settings:update", config: { noAnimation: event.currentTarget.checked } })
              }
            />
          </label>
          <label className="setting-row checkbox-row">
            <span>Debug overlay</span>
            <input
              type="checkbox"
              checked={config.debugOverlay}
              onChange={(event) =>
                postToExtension({ type: "settings:update", config: { debugOverlay: event.currentTarget.checked } })
              }
            />
          </label>
          <div className="settings-actions">
            <button type="button" onClick={() => postToExtension({ type: "command:resetSettings" })}>
              Reset settings
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}
