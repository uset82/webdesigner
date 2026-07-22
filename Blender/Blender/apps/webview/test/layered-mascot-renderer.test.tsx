import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AvatarState } from "../src/bridge/messages";
import {
  getLayeredMascotStyle,
  LayeredMascotRenderer,
  shouldUseLayeredMascot
} from "../src/renderers/LayeredMascotRenderer";

const requiredPrototypeStates: AvatarState[] = ["idle", "thinking", "speaking", "success", "error"];

describe("LayeredMascotRenderer", () => {
  it("recreates the supplied character as safe, named SVG layers", () => {
    const markup = renderMascot("idle");

    for (const layer of [
      "avatar/root",
      "avatar/body",
      "avatar/head",
      "avatar/hair/back",
      "avatar/hair/front",
      "avatar/eyes/left",
      "avatar/eyes/right",
      "avatar/eyelids",
      "avatar/mouth",
      "avatar/hat",
      "avatar/scarf",
      "avatar/cape",
      "avatar/skirt",
      "avatar/reactions"
    ]) {
      expect(markup).toContain(`data-layer="${layer}"`);
      expect(markup).toContain(`id="${layer}"`);
    }
    expect(markup).toContain('data-avatar-source="layered-mascot"');
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("<object");
    expect(markup).not.toContain("dangerouslySetInnerHTML");
  });

  it.each(requiredPrototypeStates)("exposes the %s state to the animation layer", (state) => {
    expect(renderMascot(state)).toContain(`data-avatar-state="${state}"`);
  });

  it("maps pointer gaze and lip-sync input to bounded animation variables", () => {
    expect(getLayeredMascotStyle("speaking", { cursorX: 1, cursorY: 0, mouthOpen: 0.8 }, true, false)).toMatchObject({
      "--mascot-look-x": "6.00px",
      "--mascot-look-y": "-4.00px",
      "--mascot-head-rotate": "1.20deg",
      "--mascot-mouth-open": "1.32"
    });
    expect(getLayeredMascotStyle("speaking", { cursorX: 20, cursorY: -10, mouthOpen: 5 }, true, true)).toMatchObject({
      "--mascot-look-x": "2.70px",
      "--mascot-look-y": "-1.80px",
      "--mascot-mouth-open": "1.50"
    });
  });

  it("selects only the reference avatar package so all other packages keep the generic SVG fallback", () => {
    expect(shouldUseLayeredMascot({ id: "skjermbilde-character" })).toBe(true);
    expect(shouldUseLayeredMascot({ id: "SKJERMBILDE-CHARACTER" })).toBe(true);
    expect(shouldUseLayeredMascot({ id: "another-avatar" })).toBe(false);
  });

  it("keeps expressions available while reduced motion disables continuous movement", () => {
    const markup = renderToStaticMarkup(
      <LayeredMascotRenderer
        state="error"
        poseInput={{}}
        reducedMotion
        intensity="low"
        focusMode
        lipSyncEnabled={false}
        triggerEvent={{ trigger: "shake", sequence: 2 }}
      />
    );

    expect(markup).toContain('data-reduced-motion="true"');
    expect(markup).toContain('data-focus-mode="true"');
    expect(markup).toContain('class="mascot-error-effect"');
  });
});

function renderMascot(state: AvatarState): string {
  return renderToStaticMarkup(
    <LayeredMascotRenderer
      state={state}
      poseInput={{ cursorX: 0.5, cursorY: 0.5 }}
      reducedMotion={false}
      intensity="medium"
      focusMode={false}
      lipSyncEnabled
      triggerEvent={null}
    />
  );
}
