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
exports.SkillRouter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SkillRouter {
    registry;
    policy;
    constructor(workspaceRoot) {
        const registryPath = path.join(workspaceRoot, '.antigravity', 'runtime', 'provider-registry.json');
        const policyPath = path.join(workspaceRoot, '.antigravity', 'runtime', 'routing-policy.json');
        this.registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        this.policy = JSON.parse(fs.readFileSync(policyPath, 'utf-8'));
    }
    capabilityToScore(val) {
        const scores = { none: 0, low: 1, medium: 2, high: 3 };
        return scores[val] || 0;
    }
    tierToScore(val, invert) {
        const scores = { low: 1, medium: 2, high: 3 };
        const score = scores[val] || 2;
        return invert ? (4 - score) : score; // for cost/latency, "low" (1) is better if inverted
    }
    selectModel(stage, userOverride, lastModelKey) {
        const stagePolicy = this.policy.stagePolicies[stage];
        if (!stagePolicy) {
            throw new Error(`No routing policy configured for stage: ${stage}`);
        }
        // Find all candidate models
        const candidates = [];
        for (const provider of this.registry.providers) {
            for (const model of provider.models) {
                // 1. Check if model meets required capabilities (must be > 'none' for required ones)
                let meetsRequired = true;
                for (const reqCap of stagePolicy.requiredCapabilities) {
                    const capValue = model.capabilities[reqCap];
                    if (!capValue || capValue === 'none') {
                        meetsRequired = false;
                        break;
                    }
                }
                if (!meetsRequired)
                    continue;
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
                    capScore += this.capabilityToScore(model.capabilities[reqCap]);
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
    getModelDetails(modelKey) {
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
exports.SkillRouter = SkillRouter;
