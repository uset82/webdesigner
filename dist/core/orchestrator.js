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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebDesignerOrchestrator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const router_1 = require("./router");
class WebDesignerOrchestrator {
    workspaceRoot;
    router;
    catalog;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.router = new router_1.SkillRouter(workspaceRoot);
        const catalogPath = path.join(workspaceRoot, '.antigravity', 'runtime', 'stack-catalog.json');
        this.catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    }
    getRouter() {
        return this.router;
    }
    intake(taskId, title, prompt, options) {
        // Detect experience type from prompt if not specified
        let expType = options?.experienceType || 'spa-web';
        const lp = prompt.toLowerCase();
        if (lp.includes('seo') || lp.includes('ssr') || lp.includes('next.js') || lp.includes('nextjs')) {
            expType = 'seo-fullstack-web';
        }
        else if (lp.includes('mobile') || lp.includes('flutter') || lp.includes('android') || lp.includes('ios')) {
            expType = 'cross-platform-mobile';
        }
        else if (lp.includes('backend') || lp.includes('api') || lp.includes('express')) {
            expType = 'api-backend';
        }
        const supportsReactUi = expType === 'seo-fullstack-web' || expType === 'spa-web';
        const hasAnimationIntent = /\b(animate(?:d|s|ing)?|animation(?:s)?|motion|micro[-\s]?interaction(?:s)?|transition(?:s)?|scroll[-\s]?reveal(?:s)?|parallax|morph(?:ing)?|kinetic)\b/.test(lp);
        const hasUiSurface = /\b(ui|user interface|interface|website|web site|landing page|portfolio|storefront|web app|dashboard|component|menu|navigation|navbar|button|dialog|modal|tab|tabs|accordion|tooltip|carousel|form|icon|text|hero|section|page)\b/.test(lp);
        const isMediaOnlyAnimation = /\b(video|film|clip|mp4|gif|webp|remotion|animation asset|animated illustration)\b/.test(lp) && !hasUiSurface;
        const requiresAnimatedUI = options?.requiresAnimatedUI ?? (supportsReactUi && hasAnimationIntent && !isMediaOnlyAnimation);
        const hasImageToThreeIntent = /\b(img2threejs|image[-\s]?to[-\s]?(?:3d|three(?:\.?js)?|threejs)|photo[-\s]?to[-\s]?(?:3d|three(?:\.?js)?|threejs)|reference image.*(?:three(?:\.?js)?|threejs|3d model)|(?:three(?:\.?js)?|threejs).*(?:from|via|using).*(?:image|photo|reference)|procedural (?:three(?:\.?js)?|threejs) model|rebuild (?:this |the )?(?:object|image).*(?:three(?:\.?js)?|threejs|3d)|sculpt(?:ing)? (?:spec|from (?:image|photo)))\b/.test(lp)
            || (/\b(three(?:\.?js)?|threejs|webgl|procedural 3d|3d model|object sculpt)\b/.test(lp)
                && /\b(image|photo|reference|screenshot|picture|pic)\b/.test(lp));
        const requiresImageToThreeJS = options?.requiresImageToThreeJS ?? (supportsReactUi && hasImageToThreeIntent);
        const requestedStages = ['plan', 'design', 'build', 'security', 'review', 'deploy'];
        return {
            version: "1.0",
            taskId,
            title,
            prompt,
            requestedStages,
            constraints: {
                experienceType: expType,
                requiresSEO: expType === 'seo-fullstack-web',
                requiresVision: lp.includes('image') || lp.includes('screenshot') || lp.includes('figma') || requiresImageToThreeJS,
                requiresImageGeneration: lp.includes('generate image') || lp.includes('illustration'),
                requiresAnimatedUI,
                requiresImageToThreeJS,
                latencyPreference: options?.latencyPreference || "balanced",
                budgetPreference: options?.budgetPreference || "balanced",
                designProvider: options?.designProvider || "stitch"
            },
            context: {
                host: "antigravity",
                sourceDocs: [],
                currentArtifactIds: []
            }
        };
    }
    selectStack(intent) {
        const expType = intent.constraints.experienceType || 'spa-web';
        // Find matching recommended path in catalog
        const pathMatch = this.catalog.recommendedPaths.find((p) => p.selection.experienceType === expType);
        let selection;
        if (pathMatch) {
            selection = {
                version: "1.0",
                selectionId: `sel-${intent.taskId}`,
                ...pathMatch.selection,
                rationale: [
                    `Matched recommended stack for ${expType}`,
                    `Selected ${pathMatch.selection.frontendRuntime} for frontend and ${pathMatch.selection.backendRuntime} for backend.`,
                    `Configured deployment to ${pathMatch.selection.deploymentTarget}.`
                ]
            };
        }
        else {
            // Fallback selection if no match
            selection = {
                version: "1.0",
                selectionId: `sel-${intent.taskId}`,
                experienceType: expType,
                frontendRuntime: "react-vite",
                backendRuntime: "node-express",
                dataLayer: "none",
                deploymentTarget: "netlify",
                designProvider: "stitch",
                integrations: [],
                rationale: ["Default fallback stack selection applied."]
            };
        }
        if (intent.constraints.requiresAnimatedUI) {
            const supportsAnimateUi = selection.frontendRuntime === 'nextjs' || selection.frontendRuntime === 'react-vite';
            if (supportsAnimateUi) {
                selection.integrations = Array.from(new Set([...selection.integrations, 'animate-ui']));
                selection.rationale.push('Animated UI requested; enabled the Animate UI component registry for the build stage.');
            }
            else {
                selection.rationale.push(`Animated UI requested, but Animate UI is incompatible with ${selection.frontendRuntime}; use a framework-native motion solution.`);
            }
        }
        if (intent.constraints.requiresImageToThreeJS) {
            const supportsImg2Three = selection.frontendRuntime === 'nextjs' || selection.frontendRuntime === 'react-vite';
            if (supportsImg2Three) {
                selection.integrations = Array.from(new Set([...selection.integrations, 'img2threejs']));
                selection.rationale.push('Image-to-Three.js reconstruction requested; enabled the img2threejs sculpting pipeline for the build stage.');
            }
            else {
                selection.rationale.push(`Image-to-Three.js requested, but img2threejs is incompatible with ${selection.frontendRuntime}; use a React web frontend or a framework-native 3D approach.`);
            }
        }
        return selection;
    }
    createManifest(intent, selection) {
        return {
            version: "1.0",
            manifestId: `manifest-${intent.taskId}`,
            taskId: intent.taskId,
            host: "antigravity",
            latestStage: "plan",
            stackSelectionId: selection.selectionId,
            artifacts: [
                {
                    artifactId: `art-intent-${intent.taskId}`,
                    stage: "plan",
                    artifactType: "task-intent",
                    producer: {
                        providerId: "system",
                        modelKey: "system",
                        skillId: "framework-selector"
                    },
                    summary: "Normalized user request and constraints."
                },
                {
                    artifactId: `art-selection-${intent.taskId}`,
                    stage: "plan",
                    artifactType: "stack-selection",
                    producer: {
                        providerId: "system",
                        modelKey: "system",
                        skillId: "framework-selector"
                    },
                    summary: `Selected stack: ${selection.experienceType} with ${selection.frontendRuntime}.`
                }
            ],
            handoffNotes: ["Project initialized. Ready for design stage."]
        };
    }
    runStage(manifest, stage, skillId, modelKey, emitted, notes) {
        const { provider } = this.router.getModelDetails(modelKey);
        const records = emitted.map((e, idx) => ({
            artifactId: `art-${stage}-${manifest.taskId}-${idx}-${Date.now()}`,
            stage,
            artifactType: e.type,
            producer: {
                providerId: provider.id,
                modelKey,
                skillId
            },
            path: e.path,
            summary: e.summary
        }));
        return {
            ...manifest,
            latestStage: stage,
            artifacts: [...manifest.artifacts, ...records],
            handoffNotes: [...manifest.handoffNotes, notes]
        };
    }
    saveWorkspaceFile(relativeFilePath, content) {
        const absolutePath = path.join(this.workspaceRoot, relativeFilePath);
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(absolutePath, content, 'utf-8');
        return absolutePath;
    }
}
exports.WebDesignerOrchestrator = WebDesignerOrchestrator;
