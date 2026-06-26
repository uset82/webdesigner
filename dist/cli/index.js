#!/usr/bin/env node
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
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const orchestrator_1 = require("../core/orchestrator");
const program = new commander_1.Command();
const orchestrator = new orchestrator_1.WebDesignerOrchestrator(process.cwd());
program
    .name('wd')
    .description('WebDesigner Orchestration Command Line Interface')
    .version('1.0.0');
program
    .command('init')
    .description('Initialize a new project stack selection and manifest based on prompt')
    .argument('<prompt>', 'The natural language prompt describing the web page or app to build')
    .option('-t, --title <title>', 'The project title', 'New WebDesigner Project')
    .action((prompt, options) => {
    const taskId = `task-${Date.now().toString().slice(-6)}`;
    const intent = orchestrator.intake(taskId, options.title, prompt);
    const selection = orchestrator.selectStack(intent);
    const manifest = orchestrator.createManifest(intent, selection);
    fs.writeFileSync(path.join(process.cwd(), 'task_intent.json'), JSON.stringify(intent, null, 2), 'utf-8');
    fs.writeFileSync(path.join(process.cwd(), 'stack_selection.json'), JSON.stringify(selection, null, 2), 'utf-8');
    fs.writeFileSync(path.join(process.cwd(), 'artifact_manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`\n\x1b[32m✔ Project initialized successfully!\x1b[0m`);
    console.log(`Task ID:       ${taskId}`);
    console.log(`Experience:    ${selection.experienceType}`);
    console.log(`Frontend:      ${selection.frontendRuntime}`);
    console.log(`Backend:       ${selection.backendRuntime}`);
    console.log(`Deployment:    ${selection.deploymentTarget}`);
    console.log(`Manifest created at artifact_manifest.json\n`);
});
program
    .command('route')
    .description('Resolve the optimal model for a given stage using capability weights')
    .argument('<stage>', 'The lifecycle stage (plan, design, build, security, review, deploy)')
    .option('-o, --override <modelKey>', 'Manual override model key')
    .action((stage, options) => {
    try {
        const bestModel = orchestrator.getRouter().selectModel(stage, options.override);
        const details = orchestrator.getRouter().getModelDetails(bestModel);
        console.log(`\nOptimal model resolved for stage [\x1b[36m${stage}\x1b[0m]:`);
        console.log(`Model Key:     \x1b[33m${bestModel}\x1b[0m`);
        console.log(`Provider:      ${details.provider.displayName}`);
        console.log(`Adapter:       ${details.provider.adapterId}`);
        console.log(`Capabilities:  Reasoning=${details.model.capabilities.reasoning}, Coding=${details.model.capabilities.coding}, ToolUse=${details.model.capabilities.toolUse}\n`);
    }
    catch (e) {
        console.error(`\x1b[31mError: ${e.message}\x1b[0m`);
    }
});
program
    .command('run')
    .description('Record the execution of a stage and log its emitted artifacts')
    .argument('<stage>', 'The current stage completed')
    .requiredOption('-s, --skill <skillId>', 'The skill id executed')
    .requiredOption('-m, --model <modelKey>', 'The model key that ran the stage')
    .requiredOption('-e, --emitted <jsonString>', 'JSON array of artifacts: [{"type":"...", "summary":"...", "path":"..."}]')
    .requiredOption('-n, --notes <notes>', 'Handoff progress summary notes')
    .action((stage, options) => {
    const manifestPath = path.join(process.cwd(), 'artifact_manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.error(`\x1b[31mError: artifact_manifest.json not found in current directory. Run 'wd init' first.\x1b[0m`);
        process.exit(1);
    }
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const emittedArtifacts = JSON.parse(options.emitted);
        const updatedManifest = orchestrator.runStage(manifest, stage, options.skill, options.model, emittedArtifacts, options.notes);
        fs.writeFileSync(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf-8');
        console.log(`\n\x1b[32m✔ Manifest updated successfully!\x1b[0m`);
        console.log(`Latest Stage:  \x1b[36m${stage}\x1b[0m`);
        console.log(`Total Artifacts: ${updatedManifest.artifacts.length}`);
        console.log(`Handoff notes recorded.\n`);
    }
    catch (e) {
        console.error(`\x1b[31mError: ${e.message}\x1b[0m`);
    }
});
program
    .command('status')
    .description('Show the current project status and artifact history')
    .action(() => {
    const manifestPath = path.join(process.cwd(), 'artifact_manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.log(`\nNo active project found in this directory. Run 'wd init "<prompt>"' to begin.\n`);
        return;
    }
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        console.log(`\n\x1b[35m=== WebDesigner Project Status ===\x1b[0m`);
        console.log(`Task ID:      ${manifest.taskId}`);
        console.log(`Latest Stage: \x1b[36m${manifest.latestStage}\x1b[0m`);
        console.log(`Host:         ${manifest.host}`);
        console.log(`\n\x1b[4mArtifact Log:\x1b[0m`);
        manifest.artifacts.forEach((art) => {
            console.log(` - [\x1b[32m${art.stage}\x1b[0m] ${art.artifactType} (${art.producer.skillId}): ${art.summary} ${art.path ? `-> ${art.path}` : ''}`);
        });
        console.log(`\n\x1b[4mHandoff History Notes:\x1b[0m`);
        manifest.handoffNotes.forEach((n) => {
            console.log(` * ${n}`);
        });
        console.log();
    }
    catch (e) {
        console.error(`\x1b[31mError reading status: ${e.message}\x1b[0m`);
    }
});
program.parse(process.argv);
