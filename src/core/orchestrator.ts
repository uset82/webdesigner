import * as fs from 'fs';
import * as path from 'path';
import { SkillRouter } from './router';

export interface TaskIntent {
  version: "1.0";
  taskId: string;
  title: string;
  prompt: string;
  requestedStages: string[];
  constraints: {
    experienceType?: string;
    requiresSEO?: boolean;
    requiresVision?: boolean;
    requiresImageGeneration?: boolean;
    requiresAnimatedUI?: boolean;
    requiresGSAPAnimation?: boolean;
    requires3DScrollCanvas?: boolean;
    requiresVideoToSite?: boolean;
    requiresImageToThreeJS?: boolean;
    preferredProviders?: string[];
    excludedProviders?: string[];
    latencyPreference?: "low" | "balanced" | "quality";
    budgetPreference?: "low" | "balanced" | "quality";
    designProvider?: string;
  };
  context: {
    host: string;
    sourceDocs?: string[];
    currentArtifactIds?: string[];
  };
}

export interface StackSelection {
  version: "1.0";
  selectionId: string;
  experienceType: string;
  frontendRuntime: string;
  backendRuntime: string;
  dataLayer: string;
  deploymentTarget: string;
  designProvider: string;
  integrations: string[];
  rationale: string[];
}

export interface ArtifactRecord {
  artifactId: string;
  stage: string;
  artifactType: string;
  producer: {
    providerId: string;
    modelKey: string;
    skillId: string;
  };
  path?: string;
  summary: string;
  dependsOn?: string[];
}

export interface ArtifactManifest {
  version: "1.0";
  manifestId: string;
  taskId: string;
  host: string;
  latestStage: string;
  stackSelectionId?: string;
  artifacts: ArtifactRecord[];
  handoffNotes: string[];
}

export class WebDesignerOrchestrator {
  private workspaceRoot: string;
  private router: SkillRouter;
  private catalog: any;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.router = new SkillRouter(workspaceRoot);
    
    const catalogPath = path.join(workspaceRoot, '.antigravity', 'runtime', 'stack-catalog.json');
    this.catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  }

  public getRouter(): SkillRouter {
    return this.router;
  }

  public intake(taskId: string, title: string, prompt: string, options?: Partial<TaskIntent['constraints']>): TaskIntent {
    // Detect experience type from prompt if not specified
    let expType = options?.experienceType || 'spa-web';
    const lp = prompt.toLowerCase();
    
    if (lp.includes('seo') || lp.includes('ssr') || lp.includes('next.js') || lp.includes('nextjs')) {
      expType = 'seo-fullstack-web';
    } else if (lp.includes('mobile') || lp.includes('flutter') || lp.includes('android') || lp.includes('ios')) {
      expType = 'cross-platform-mobile';
    } else if (lp.includes('backend') || lp.includes('api') || lp.includes('express')) {
      expType = 'api-backend';
    }

    const supportsReactUi = expType === 'seo-fullstack-web' || expType === 'spa-web';
    const hasAnimationIntent = /\b(animate(?:d|s|ing)?|animation(?:s)?|motion|micro[-\s]?interaction(?:s)?|transition(?:s)?|scroll[-\s]?reveal(?:s)?|parallax|morph(?:ing)?|kinetic)\b/.test(lp);
    const hasUiSurface = /\b(ui|user interface|interface|website|web site|landing page|portfolio|storefront|web app|dashboard|component|menu|navigation|navbar|button|dialog|modal|tab|tabs|accordion|tooltip|carousel|form|icon|text|hero|section|page)\b/.test(lp);
    const isMediaOnlyAnimation = /\b(video|film|clip|mp4|gif|webp|remotion|animation asset|animated illustration)\b/.test(lp) && !hasUiSurface;
    const requiresAnimatedUI = options?.requiresAnimatedUI ?? (
      supportsReactUi && hasAnimationIntent && !isMediaOnlyAnimation
    );

    const hasGSAPIntent = /\b(gsap|scrolltrigger|scrollsmoother|splittext|morphsvg|drawsvg|greensock|inertia|flip[-\s]?plugin|custombounce|customwiggle|scrambletext)\b/.test(lp);
    const requiresGSAPAnimation = options?.requiresGSAPAnimation ?? (
      supportsReactUi && hasGSAPIntent
    );

    const has3DScrollCanvasIntent = /\b(3d[-\s]?scroll|frame[-\s]?sequence|sticky[-\s]?canvas|canvas[-\s]?frame|video[-\s]?to[-\s]?(?:frame|scroll)|lenis|apple[-\s]?(?:style|like)?\s*scroll|scroll[-\s]?canvas|pre[-\s]?rendered scroll)\b/.test(lp);
    const requires3DScrollCanvas = options?.requires3DScrollCanvas ?? (
      supportsReactUi && has3DScrollCanvasIntent
    );

    const hasVideoToSiteIntent = /\b(video[-\s]?to[-\s]?(?:site|scroll|canvas|web)|videotoside|extract[-\s]?frames|convert video|video[-\s]?driven)\b/.test(lp);
    const requiresVideoToSite = options?.requiresVideoToSite ?? (
      supportsReactUi && hasVideoToSiteIntent
    );

    const hasImageToThreeIntent = /\b(img2threejs|image[-\s]?to[-\s]?(?:3d|three(?:\.?js)?|threejs)|photo[-\s]?to[-\s]?(?:3d|three(?:\.?js)?|threejs)|reference image.*(?:three(?:\.?js)?|threejs|3d model)|(?:three(?:\.?js)?|threejs).*(?:from|via|using).*(?:image|photo|reference)|procedural (?:three(?:\.?js)?|threejs) model|rebuild (?:this |the )?(?:object|image).*(?:three(?:\.?js)?|threejs|3d)|sculpt(?:ing)? (?:spec|from (?:image|photo)))\b/.test(lp)
      || (/\b(three(?:\.?js)?|threejs|webgl|procedural 3d|3d model|object sculpt)\b/.test(lp)
        && /\b(image|photo|reference|screenshot|picture|pic)\b/.test(lp));
    const requiresImageToThreeJS = options?.requiresImageToThreeJS ?? (
      supportsReactUi && hasImageToThreeIntent
    );

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
        requiresGSAPAnimation,
        requires3DScrollCanvas,
        requiresVideoToSite,
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

  public selectStack(intent: TaskIntent): StackSelection {
    const expType = intent.constraints.experienceType || 'spa-web';
    
    // Find matching recommended path in catalog
    const pathMatch = this.catalog.recommendedPaths.find(
      (p: any) => p.selection.experienceType === expType
    );

    let selection: StackSelection;

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
    } else {
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
      } else {
        selection.rationale.push(`Animated UI requested, but Animate UI is incompatible with ${selection.frontendRuntime}; use a framework-native motion solution.`);
      }
    }

    if (intent.constraints.requiresGSAPAnimation) {
      const supportsGSAP = selection.frontendRuntime === 'nextjs' || selection.frontendRuntime === 'react-vite';
      if (supportsGSAP) {
        selection.integrations = Array.from(new Set([...selection.integrations, 'gsap-animation']));
        selection.rationale.push('GSAP animation requested; enabled the gsap-animation engine for the build stage.');
      } else {
        selection.rationale.push(`GSAP animation requested, but GSAP integration is incompatible with ${selection.frontendRuntime}; use a framework-native motion solution.`);
      }
    }

    if (intent.constraints.requires3DScrollCanvas) {
      const supports3DScroll = selection.frontendRuntime === 'nextjs' || selection.frontendRuntime === 'react-vite';
      if (supports3DScroll) {
        selection.integrations = Array.from(new Set([...selection.integrations, '3d-scroll-canvas']));
        selection.rationale.push('3D scroll frame-sequence animation requested; enabled the 3d-scroll-website skill pipeline for the build stage.');
      } else {
        selection.rationale.push(`3D scroll canvas requested, but 3d-scroll-canvas is incompatible with ${selection.frontendRuntime}; use a React web frontend.`);
      }
    }

    if (intent.constraints.requiresVideoToSite) {
      const supportsVideoToSite = selection.frontendRuntime === 'nextjs' || selection.frontendRuntime === 'react-vite';
      if (supportsVideoToSite) {
        selection.integrations = Array.from(new Set([...selection.integrations, 'video-to-site']));
        selection.rationale.push('Video-to-site conversion requested; enabled the video-to-site frame controller pipeline for the build stage.');
      } else {
        selection.rationale.push(`Video-to-site requested, but video-to-site is incompatible with ${selection.frontendRuntime}; use a React web frontend.`);
      }
    }

    if (intent.constraints.requiresImageToThreeJS) {
      const supportsImg2Three = selection.frontendRuntime === 'nextjs' || selection.frontendRuntime === 'react-vite';
      if (supportsImg2Three) {
        selection.integrations = Array.from(new Set([...selection.integrations, 'img2threejs']));
        selection.rationale.push('Image-to-Three.js reconstruction requested; enabled the img2threejs sculpting pipeline for the build stage.');
      } else {
        selection.rationale.push(`Image-to-Three.js requested, but img2threejs is incompatible with ${selection.frontendRuntime}; use a React web frontend or a framework-native 3D approach.`);
      }
    }

    return selection;
  }

  public createManifest(intent: TaskIntent, selection: StackSelection): ArtifactManifest {
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

  public runStage(
    manifest: ArtifactManifest,
    stage: string,
    skillId: string,
    modelKey: string,
    emitted: { type: string; summary: string; path?: string }[],
    notes: string
  ): ArtifactManifest {
    const { provider } = this.router.getModelDetails(modelKey);
    
    const records: ArtifactRecord[] = emitted.map((e, idx) => ({
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

  public saveWorkspaceFile(relativeFilePath: string, content: string): string {
    const absolutePath = path.join(this.workspaceRoot, relativeFilePath);
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absolutePath, content, 'utf-8');
    return absolutePath;
  }
}
