"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const path = __importStar(require("path"));
const orchestrator_1 = require("./orchestrator");
const workspaceRoot = path.resolve(__dirname, '..', '..');
function route(prompt, options = {}) {
    const orchestrator = new orchestrator_1.WebDesignerOrchestrator(workspaceRoot);
    const intent = orchestrator.intake('animation-test', 'Animation test', prompt, options);
    return { intent, selection: orchestrator.selectStack(intent) };
}
(0, node_test_1.default)('animated web UI enables Animate UI', () => {
    const { intent, selection } = route('Build a product landing page with smooth animations and micro-interactions.');
    strict_1.default.equal(intent.constraints.requiresAnimatedUI, true);
    strict_1.default.deepEqual(selection.integrations, ['animate-ui']);
    strict_1.default.equal(selection.frontendRuntime, 'react-vite');
});
(0, node_test_1.default)('animated Next.js UI enables Animate UI', () => {
    const { selection } = route('Build an SEO-friendly Next.js site with animated UI transitions.');
    strict_1.default.deepEqual(selection.integrations, ['animate-ui']);
    strict_1.default.equal(selection.frontendRuntime, 'nextjs');
});
(0, node_test_1.default)('static UI and rendered video do not enable Animate UI', () => {
    const staticResult = route('Build a clean product landing page.');
    const videoResult = route('Create an animated video with Remotion and export an MP4.');
    strict_1.default.equal(staticResult.intent.constraints.requiresAnimatedUI, false);
    strict_1.default.deepEqual(staticResult.selection.integrations, []);
    strict_1.default.equal(videoResult.intent.constraints.requiresAnimatedUI, false);
    strict_1.default.deepEqual(videoResult.selection.integrations, []);
});
(0, node_test_1.default)('incompatible frontend records a fallback instead of enabling Animate UI', () => {
    const { selection } = route('Build a Flutter app with animated UI.', {
        experienceType: 'cross-platform-mobile',
        requiresAnimatedUI: true
    });
    strict_1.default.deepEqual(selection.integrations, []);
    strict_1.default.match(selection.rationale.at(-1) || '', /incompatible with flutter/);
});
(0, node_test_1.default)('image-to-Three.js prompts enable img2threejs', () => {
    const { intent, selection } = route('Rebuild this product reference image as a procedural Three.js model for a React product page.');
    strict_1.default.equal(intent.constraints.requiresImageToThreeJS, true);
    strict_1.default.equal(intent.constraints.requiresVision, true);
    strict_1.default.deepEqual(selection.integrations, ['img2threejs']);
    strict_1.default.equal(selection.frontendRuntime, 'react-vite');
});
(0, node_test_1.default)('explicit img2threejs request enables the integration on Next.js', () => {
    const { selection } = route('Use img2threejs to rebuild this object image as a Three.js model on a Next.js site.');
    strict_1.default.deepEqual(selection.integrations, ['img2threejs']);
    strict_1.default.equal(selection.frontendRuntime, 'nextjs');
});
(0, node_test_1.default)('image-only and static prompts do not enable img2threejs', () => {
    const imageOnly = route('Generate an image illustration for the hero section.');
    const staticUi = route('Build a clean product landing page.');
    strict_1.default.equal(imageOnly.intent.constraints.requiresImageToThreeJS, false);
    strict_1.default.ok(!imageOnly.selection.integrations.includes('img2threejs'));
    strict_1.default.equal(staticUi.intent.constraints.requiresImageToThreeJS, false);
    strict_1.default.deepEqual(staticUi.selection.integrations, []);
});
(0, node_test_1.default)('incompatible frontend records a fallback instead of enabling img2threejs', () => {
    const { selection } = route('Rebuild this image as a Three.js model in Flutter.', {
        experienceType: 'cross-platform-mobile',
        requiresImageToThreeJS: true
    });
    strict_1.default.deepEqual(selection.integrations, []);
    strict_1.default.match(selection.rationale.at(-1) || '', /incompatible with flutter/);
});
(0, node_test_1.default)('animated UI and img2threejs can activate together', () => {
    const { selection } = route('Build an animated React landing page and rebuild this product reference image as a Three.js model.');
    strict_1.default.deepEqual(selection.integrations.sort(), ['animate-ui', 'img2threejs']);
});
