import assert from "node:assert/strict";
import { test } from "vitest";
import { AudioReactiveMouth, MockAudioLevelGenerator } from "../src/index.js";

test("smooths attack and release while emitting speaking transitions", () => {
  const events: string[] = [];
  const mouth = new AudioReactiveMouth({
    attackMs: 40,
    releaseMs: 160,
    silenceThreshold: 0.05,
    onSpeakingStart: () => events.push("start"),
    onSpeakingStop: () => events.push("stop")
  });

  const attack = mouth.update(1, 40);
  assert.ok(attack.mouthOpen > 0.5);
  assert.equal(attack.speaking, true);
  const release = mouth.update(0, 800);
  assert.ok(release.mouthOpen < attack.mouthOpen);
  assert.equal(release.speaking, false);
  assert.deepEqual(events, ["start", "stop"]);
});

test("accepts normalized levels and provides a deterministic mock generator", () => {
  const mouth = new AudioReactiveMouth({ attackMs: 1, releaseMs: 1 });
  assert.equal(mouth.update(2, 100).amplitude, 1);
  assert.equal(mouth.update(-1, 100).amplitude, 0);

  const generator = new MockAudioLevelGenerator([0.1, 0.8]);
  assert.deepEqual([generator.next(), generator.next(), generator.next()], [0.1, 0.8, 0.1]);
  generator.reset();
  assert.equal(generator.next(), 0.1);
});
