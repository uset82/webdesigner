import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { WebDesignerOrchestrator } from './orchestrator';

const workspaceRoot = path.resolve(__dirname, '..', '..');

function route(prompt: string, options: Parameters<WebDesignerOrchestrator['intake']>[3] = {}) {
  const orchestrator = new WebDesignerOrchestrator(workspaceRoot);
  const intent = orchestrator.intake('animation-test', 'Animation test', prompt, options);
  return { intent, selection: orchestrator.selectStack(intent) };
}

test('animated web UI enables Animate UI', () => {
  const { intent, selection } = route('Build a product landing page with smooth animations and micro-interactions.');

  assert.equal(intent.constraints.requiresAnimatedUI, true);
  assert.deepEqual(selection.integrations, ['animate-ui']);
  assert.equal(selection.frontendRuntime, 'react-vite');
});

test('animated Next.js UI enables Animate UI', () => {
  const { selection } = route('Build an SEO-friendly Next.js site with animated UI transitions.');

  assert.deepEqual(selection.integrations, ['animate-ui']);
  assert.equal(selection.frontendRuntime, 'nextjs');
});

test('static UI and rendered video do not enable Animate UI', () => {
  const staticResult = route('Build a clean product landing page.');
  const videoResult = route('Create an animated video with Remotion and export an MP4.');

  assert.equal(staticResult.intent.constraints.requiresAnimatedUI, false);
  assert.deepEqual(staticResult.selection.integrations, []);
  assert.equal(videoResult.intent.constraints.requiresAnimatedUI, false);
  assert.deepEqual(videoResult.selection.integrations, []);
});

test('incompatible frontend records a fallback instead of enabling Animate UI', () => {
  const { selection } = route('Build a Flutter app with animated UI.', {
    experienceType: 'cross-platform-mobile',
    requiresAnimatedUI: true
  });

  assert.deepEqual(selection.integrations, []);
  assert.match(selection.rationale.at(-1) || '', /incompatible with flutter/);
});

test('GSAP animation prompts enable gsap-animation integration', () => {
  const { intent, selection } = route('Build a web landing page with GSAP ScrollTrigger and SplitText animations.');

  assert.equal(intent.constraints.requiresGSAPAnimation, true);
  assert.ok(selection.integrations.includes('gsap-animation'));
  assert.equal(selection.frontendRuntime, 'react-vite');
});

test('explicit GSAP request enables integration on Next.js', () => {
  const { selection } = route('Create an SEO-friendly Next.js site with GSAP ScrollSmoother and MorphSVG.');

  assert.deepEqual(selection.integrations, ['gsap-animation']);
  assert.equal(selection.frontendRuntime, 'nextjs');
});

test('3D scroll frame-sequence prompts enable 3d-scroll-canvas integration', () => {
  const { intent, selection } = route('Build a 3D scroll-animated landing page with a sticky canvas frame sequence and Lenis smooth scroll.');

  assert.equal(intent.constraints.requires3DScrollCanvas, true);
  assert.ok(selection.integrations.includes('3d-scroll-canvas'));
  assert.equal(selection.frontendRuntime, 'react-vite');
});

test('video-to-site prompts enable video-to-site integration', () => {
  const { intent, selection } = route('Convert this hero MP4 video into a video-to-site scroll animation.');

  assert.equal(intent.constraints.requiresVideoToSite, true);
  assert.ok(selection.integrations.includes('video-to-site'));
  assert.equal(selection.frontendRuntime, 'react-vite');
});

test('image-to-Three.js prompts enable img2threejs', () => {
  const { intent, selection } = route(
    'Rebuild this product reference image as a procedural Three.js model for a React product page.'
  );

  assert.equal(intent.constraints.requiresImageToThreeJS, true);
  assert.equal(intent.constraints.requiresVision, true);
  assert.deepEqual(selection.integrations, ['img2threejs']);
  assert.equal(selection.frontendRuntime, 'react-vite');
});

test('explicit img2threejs request enables the integration on Next.js', () => {
  const { selection } = route('Use img2threejs to rebuild this object image as a Three.js model on a Next.js site.');

  assert.deepEqual(selection.integrations, ['img2threejs']);
  assert.equal(selection.frontendRuntime, 'nextjs');
});

test('image-only and static prompts do not enable img2threejs', () => {
  const imageOnly = route('Generate an image illustration for the hero section.');
  const staticUi = route('Build a clean product landing page.');

  assert.equal(imageOnly.intent.constraints.requiresImageToThreeJS, false);
  assert.ok(!imageOnly.selection.integrations.includes('img2threejs'));
  assert.equal(staticUi.intent.constraints.requiresImageToThreeJS, false);
  assert.deepEqual(staticUi.selection.integrations, []);
});

test('incompatible frontend records a fallback instead of enabling img2threejs', () => {
  const { selection } = route('Rebuild this image as a Three.js model in Flutter.', {
    experienceType: 'cross-platform-mobile',
    requiresImageToThreeJS: true
  });

  assert.deepEqual(selection.integrations, []);
  assert.match(selection.rationale.at(-1) || '', /incompatible with flutter/);
});

test('animated UI and img2threejs can activate together', () => {
  const { selection } = route(
    'Build an animated React landing page and rebuild this product reference image as a Three.js model.'
  );

  assert.deepEqual(selection.integrations.sort(), ['animate-ui', 'img2threejs']);
});
