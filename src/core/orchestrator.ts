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
        requiresVision: lp.includes('image') || lp.includes('screenshot') || lp.includes('figma'),
        requiresImageGeneration: lp.includes('generate image') || lp.includes('illustration'),
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

    if (pathMatch) {
      return {
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

    // Fallback selection if no match
    return {
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
