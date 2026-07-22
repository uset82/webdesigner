# Runtime Interfaces

```ts
export type StageName = "plan" | "design" | "build" | "security" | "review" | "deploy";

export type ExperienceType =
  | "seo-fullstack-web"
  | "spa-web"
  | "cross-platform-mobile"
  | "api-backend";

export interface TaskIntent {
  version: "1.0";
  taskId: string;
  title: string;
  prompt: string;
  requestedStages: StageName[];
  constraints: {
    experienceType?: ExperienceType;
    requiresSEO?: boolean;
    requiresVision?: boolean;
    requiresImageGeneration?: boolean;
    requiresAnimatedUI?: boolean;
    requiresImageToThreeJS?: boolean;
    requiresBlenderMCP?: boolean;
    preferredProviders?: string[];
    excludedProviders?: string[];
    latencyPreference?: "low" | "balanced" | "quality";
    budgetPreference?: "low" | "balanced" | "quality";
    designProvider?: string;
  };
  context: {
    host: "antigravity" | "external";
    sourceDocs?: string[];
    currentArtifactIds?: string[];
  };
}

export interface StackSelection {
  version: "1.0";
  selectionId: string;
  experienceType: ExperienceType;
  frontendRuntime: "nextjs" | "react-vite" | "flutter" | "none";
  backendRuntime: "nextjs-route-handlers" | "node-express" | "none";
  dataLayer: "none" | "prisma" | "mongodb" | "mysql";
  deploymentTarget: "vercel" | "netlify" | "cloud-run" | "docker" | "mobile-store";
  designProvider: "stitch" | "outline";
  integrations: Array<"google-maps" | "animate-ui" | "img2threejs" | "blender-mcp">;
  rationale: string[];
}

export interface CapabilityProfile {
  reasoning: "none" | "low" | "medium" | "high";
  coding: "none" | "low" | "medium" | "high";
  vision: "none" | "low" | "medium" | "high";
  imageGeneration: "none" | "low" | "medium" | "high";
  securityAnalysis: "none" | "low" | "medium" | "high";
  toolUse: "none" | "low" | "medium" | "high";
  contextWindow: "small" | "medium" | "large";
  latencyTier: "low" | "medium" | "high";
  costTier: "low" | "medium" | "high";
}

export interface ProviderAdapter {
  providerId: string;
  listModels(): Promise<string[]>;
  getCapabilities(modelKey: string): CapabilityProfile;
  invokeStage(stage: StageName, modelKey: string, input: unknown): Promise<unknown>;
}

export interface RoutingPolicy {
  policyId: string;
  selectModel(stage: StageName, required: Partial<CapabilityProfile>, userOverride?: string): string;
  fallback(stage: StageName, failedModelKey: string): string | null;
}

export interface SkillContract<I, O> {
  skillId: string;
  stage: StageName;
  inputSchemaRef: string;
  outputSchemaRef?: string;
  emittedArtifacts: string[];
  preconditions: string[];
  postconditions: string[];
  run(input: I): Promise<O>;
}

export interface ArtifactRecord {
  artifactId: string;
  stage: StageName;
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

export interface SecurityThreatModel {
  summary: string;
  attackSurfaces: string[];
  trustBoundaries: string[];
  sensitiveAssets: string[];
}

export interface SecurityFinding {
  findingId: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  evidence: string[];
  remediation: string;
}

export interface ArtifactManifest {
  version: "1.0";
  manifestId: string;
  taskId: string;
  host: "antigravity" | "external";
  latestStage: StageName;
  stackSelectionId?: string;
  artifacts: ArtifactRecord[];
  handoffNotes: string[];
}

export interface HostAdapter {
  hostId: "antigravity" | string;
  exposePlanning(): Promise<void>;
  exposeReview(): Promise<void>;
  exposeBrowser(): Promise<void>;
  emitLog(message: string): Promise<void>;
}

export interface DesignProvider {
  providerId: string;
  generate(intent: TaskIntent, selection: StackSelection, manifest: ArtifactManifest): Promise<ArtifactRecord[]>;
  fallback(intent: TaskIntent, selection: StackSelection, manifest: ArtifactManifest): Promise<ArtifactRecord[]>;
}
```
