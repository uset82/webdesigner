import * as fs from 'fs';
import * as path from 'path';

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

export interface ModelEntry {
  key: string;
  displayName: string;
  configuredModelId: string;
  preferredStages: string[];
  capabilities: CapabilityProfile;
  toolAccess: string[];
  fallbackModelKeys: string[];
  aliases?: string[];
}

export interface ProviderEntry {
  id: string;
  displayName: string;
  adapterId: string;
  authEnv: string[];
  models: ModelEntry[];
}

export interface ProviderRegistry {
  version: string;
  defaultRoutingPolicy: string;
  providers: ProviderEntry[];
}

export interface StagePolicy {
  requiredCapabilities: string[];
  preferredModelKeys: string[];
}

export interface RoutingPolicy {
  version: string;
  policyId: string;
  defaults: {
    userOverrideWinsWhenValid: boolean;
    requireToolAccessMatch: boolean;
    preferStageContinuity: boolean;
    defaultBudgetPreference: string;
    defaultLatencyPreference: string;
  };
  weights: {
    capabilityMatch: number;
    toolAccess: number;
    userPreference: number;
    continuity: number;
    latency: number;
    cost: number;
  };
  stagePolicies: Record<string, StagePolicy>;
}

export class SkillRouter {
  private registry: ProviderRegistry;
  private policy: RoutingPolicy;

  constructor(workspaceRoot: string) {
    const registryPath = path.join(workspaceRoot, '.antigravity', 'runtime', 'provider-registry.json');
    const policyPath = path.join(workspaceRoot, '.antigravity', 'runtime', 'routing-policy.json');

    this.registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    this.policy = JSON.parse(fs.readFileSync(policyPath, 'utf-8'));
  }

  private capabilityToScore(val: "none" | "low" | "medium" | "high"): number {
    const scores = { none: 0, low: 1, medium: 2, high: 3 };
    return scores[val] || 0;
  }

  private tierToScore(val: "low" | "medium" | "high", invert: boolean): number {
    const scores = { low: 1, medium: 2, high: 3 };
    const score = scores[val] || 2;
    return invert ? (4 - score) : score; // for cost/latency, "low" (1) is better if inverted
  }

  public selectModel(stage: string, userOverride?: string, lastModelKey?: string): string {
    const stagePolicy = this.policy.stagePolicies[stage];
    if (!stagePolicy) {
      throw new Error(`No routing policy configured for stage: ${stage}`);
    }

    // Find all candidate models
    const candidates: { model: ModelEntry; provider: ProviderEntry; score: number }[] = [];

    for (const provider of this.registry.providers) {
      for (const model of provider.models) {
        // 1. Check if model meets required capabilities (must be > 'none' for required ones)
        let meetsRequired = true;
        for (const reqCap of stagePolicy.requiredCapabilities) {
          const capValue = model.capabilities[reqCap as keyof CapabilityProfile];
          if (!capValue || capValue === 'none') {
            meetsRequired = false;
            break;
          }
        }

        if (!meetsRequired) continue;

        // 2. If user override is specified and matches, prioritize or check validity
        if (userOverride && (model.key === userOverride || model.aliases?.includes(userOverride))) {
          if (this.policy.defaults.userOverrideWinsWhenValid) {
            return model.key;
          }
        }

        // Calculate score components
        let score = 0;

        // Capability Match Score
        let capScore = 0;
        for (const reqCap of stagePolicy.requiredCapabilities) {
          capScore += this.capabilityToScore(model.capabilities[reqCap as keyof CapabilityProfile] as any);
        }
        score += capScore * this.policy.weights.capabilityMatch;

        // Tool Access
        const toolScore = model.toolAccess.length > 0 ? 3 : 1;
        score += toolScore * this.policy.weights.toolAccess;

        // User Preference / Preferred list
        if (stagePolicy.preferredModelKeys.includes(model.key)) {
          score += 3 * this.policy.weights.userPreference;
        }

        // Continuity
        if (lastModelKey && model.key === lastModelKey && this.policy.defaults.preferStageContinuity) {
          score += 3 * this.policy.weights.continuity;
        }

        // Latency
        const latencyScore = this.tierToScore(model.capabilities.latencyTier, true); // low latency (fast) is better
        score += latencyScore * this.policy.weights.latency;

        // Cost
        const costScore = this.tierToScore(model.capabilities.costTier, true); // low cost is better
        score += costScore * this.policy.weights.cost;

        candidates.push({ model, provider, score });
      }
    }

    if (candidates.length === 0) {
      // Fallback to first available model in preferred keys
      if (stagePolicy.preferredModelKeys.length > 0) {
        return stagePolicy.preferredModelKeys[0];
      }
      throw new Error(`No models found matching required capabilities for stage: ${stage}`);
    }

    // Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].model.key;
  }

  public getModelDetails(modelKey: string): { model: ModelEntry; provider: ProviderEntry } {
    for (const provider of this.registry.providers) {
      for (const model of provider.models) {
        if (model.key === modelKey || model.aliases?.includes(modelKey)) {
          return { model, provider };
        }
      }
    }
    throw new Error(`Model not found in registry: ${modelKey}`);
  }
}
