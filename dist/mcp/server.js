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
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const orchestrator_1 = require("../core/orchestrator");
const orchestrator = new orchestrator_1.WebDesignerOrchestrator(process.cwd());
const server = new index_js_1.Server({
    name: 'webdesigner-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Helper to check manifest existence
function loadOrCreateManifest() {
    const manifestPath = path.join(process.cwd(), 'artifact_manifest.json');
    if (fs.existsSync(manifestPath)) {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }
    return null;
}
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'wd_intake_project',
                description: 'Initialize a new WebDesigner workspace. Normalizes intent, selects stack, and outputs initial manifest.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'What to build (specifications/guidelines)' },
                        title: { type: 'string', description: 'Title of the project' },
                        experienceType: {
                            type: 'string',
                            enum: ['seo-fullstack-web', 'spa-web', 'cross-platform-mobile', 'api-backend'],
                            description: 'Optional stack experience type'
                        },
                        requiresAnimatedUI: {
                            type: 'boolean',
                            description: 'Force or disable Animate UI selection; otherwise inferred from the prompt'
                        },
                        requiresImageToThreeJS: {
                            type: 'boolean',
                            description: 'Force or disable img2threejs selection; otherwise inferred from the prompt'
                        }
                    },
                    required: ['prompt']
                }
            },
            {
                name: 'wd_get_best_model',
                description: 'Calculate the optimal model for a stage based on routing policy capability weights.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        stage: {
                            type: 'string',
                            enum: ['plan', 'design', 'build', 'security', 'review', 'deploy'],
                            description: 'Stage to route'
                        },
                        override: { type: 'string', description: 'Optional model override key' }
                    },
                    required: ['stage']
                }
            },
            {
                name: 'wd_add_artifact',
                description: 'Record stage execution and append files/logs to the project manifest.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        stage: { type: 'string', description: 'Completed stage' },
                        skillId: { type: 'string', description: 'Skill name executed' },
                        modelKey: { type: 'string', description: 'Model key used' },
                        emitted: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: { type: 'string', description: 'Artifact type' },
                                    summary: { type: 'string', description: 'Detailed summary' },
                                    path: { type: 'string', description: 'Optional relative path' }
                                },
                                required: ['type', 'summary']
                            },
                            description: 'Emitted files/artifacts'
                        },
                        notes: { type: 'string', description: 'Handoff summary notes' }
                    },
                    required: ['stage', 'skillId', 'modelKey', 'emitted', 'notes']
                }
            },
            {
                name: 'wd_get_status',
                description: 'Get details about current project manifest, lifecycle progress, and file maps.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'wd_save_code_file',
                description: 'Safely write generated application code files inside the workspace.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Relative path (e.g. src/App.tsx)' },
                        content: { type: 'string', description: 'Full code contents' }
                    },
                    required: ['path', 'content']
                }
            }
        ]
    };
});
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'wd_intake_project': {
                const prompt = String(args?.prompt);
                const title = String(args?.title || 'New WebDesigner Project');
                const expType = args?.experienceType ? String(args.experienceType) : undefined;
                const requiresAnimatedUI = typeof args?.requiresAnimatedUI === 'boolean'
                    ? args.requiresAnimatedUI
                    : undefined;
                const requiresImageToThreeJS = typeof args?.requiresImageToThreeJS === 'boolean'
                    ? args.requiresImageToThreeJS
                    : undefined;
                const taskId = `task-${Date.now().toString().slice(-6)}`;
                const intent = orchestrator.intake(taskId, title, prompt, {
                    experienceType: expType,
                    requiresAnimatedUI,
                    requiresImageToThreeJS
                });
                const selection = orchestrator.selectStack(intent);
                const manifest = orchestrator.createManifest(intent, selection);
                fs.writeFileSync(path.join(process.cwd(), 'task_intent.json'), JSON.stringify(intent, null, 2), 'utf-8');
                fs.writeFileSync(path.join(process.cwd(), 'stack_selection.json'), JSON.stringify(selection, null, 2), 'utf-8');
                fs.writeFileSync(path.join(process.cwd(), 'artifact_manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                status: 'success',
                                message: 'WebDesigner project initialized successfully.',
                                taskId,
                                intent,
                                selection,
                                manifest
                            }, null, 2)
                        }
                    ]
                };
            }
            case 'wd_get_best_model': {
                const stage = String(args?.stage);
                const override = args?.override ? String(args.override) : undefined;
                const bestModel = orchestrator.getRouter().selectModel(stage, override);
                const details = orchestrator.getRouter().getModelDetails(bestModel);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                status: 'success',
                                stage,
                                modelKey: bestModel,
                                displayName: details.model.displayName,
                                provider: details.provider.displayName,
                                capabilities: details.model.capabilities
                            }, null, 2)
                        }
                    ]
                };
            }
            case 'wd_add_artifact': {
                const manifest = loadOrCreateManifest();
                if (!manifest) {
                    throw new Error('No active project manifest found. Call wd_intake_project first.');
                }
                const stage = String(args?.stage);
                const skillId = String(args?.skillId);
                const modelKey = String(args?.modelKey);
                const emitted = args?.emitted;
                const notes = String(args?.notes);
                const updatedManifest = orchestrator.runStage(manifest, stage, skillId, modelKey, emitted, notes);
                fs.writeFileSync(path.join(process.cwd(), 'artifact_manifest.json'), JSON.stringify(updatedManifest, null, 2), 'utf-8');
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                status: 'success',
                                message: 'Artifact recorded and stage progressed.',
                                manifest: updatedManifest
                            }, null, 2)
                        }
                    ]
                };
            }
            case 'wd_get_status': {
                const manifest = loadOrCreateManifest();
                if (!manifest) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    status: 'no_project',
                                    message: 'No active project directory initialized. Use wd_intake_project.'
                                }, null, 2)
                            }
                        ]
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                status: 'active',
                                manifest
                            }, null, 2)
                        }
                    ]
                };
            }
            case 'wd_save_code_file': {
                const relPath = String(args?.path);
                const content = String(args?.content);
                const absolute = orchestrator.saveWorkspaceFile(relPath, content);
                // Auto-register code file in manifest if available
                const manifest = loadOrCreateManifest();
                if (manifest) {
                    const updatedManifest = orchestrator.runStage(manifest, manifest.latestStage, 'code-generator', 'system', [{ type: 'code-file', summary: `Saved file: ${relPath}`, path: relPath }], `Created code component file: ${relPath}`);
                    fs.writeFileSync(path.join(process.cwd(), 'artifact_manifest.json'), JSON.stringify(updatedManifest, null, 2), 'utf-8');
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                status: 'success',
                                relative: relPath,
                                absolute
                            }, null, 2)
                        }
                    ]
                };
            }
            default:
                throw new Error(`Tool not found: ${name}`);
        }
    }
    catch (e) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `Error executing tool [${name}]: ${e.message}`
                }
            ]
        };
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('WebDesigner MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
