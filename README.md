# WebDesigner Codex Plugin

**WebDesigner** is an orchestration control plane and Codex plugin that coordinates planning, design, code generation, security audits, and deployment for generated applications across multiple frameworks and runtimes. 

It is designed to be provider-agnostic, model-agnostic, and host-agnostic, utilizing capability-first routing and structured handoffs to move app-building tasks across specialized models.

---

## How It Works

WebDesigner organizes application development into six distinct stages, passing structured data via an `ArtifactManifest`:

1. **Intake & Plan**: Normalizes the user prompt into a `TaskIntent` and selects a layered application stack (e.g. Next.js, React+Vite, Flutter, or Express) matching the requirements.
2. **Design**: Coordinates with design providers like Google Stitch, Figma, or custom outlines to build a visual system (mood boards, color tokens, layout specifications, and motion plans).
3. **Build**: Scaffolds the selected workspace, writes framework-idiomatic code, and inspects rendered UI layouts across desktop and mobile screens.
4. **Security**: Passes the generated code through a dedicated security audit (utilizing OpenAI Codex Security by default) to identify vulnerabilities, compile a threat model, and generate human-reviewable patch proposals.
5. **Review**: Validates accessibility, layout coherence, hero composition, spacing, and contract/manifest completeness before release.
6. **Deploy**: Configures deployment instructions and configurations for targets like Vercel, Netlify, Cloud Run, or Docker.

---

## Installation & Setup in Codex

You can distribute and install the WebDesigner plugin locally or remotely through Codex.

### 1. Register the Marketplace

Codex uses a marketplace catalog file (`marketplace.json`) to install local plugins. You can register the repository's marketplace using Git (remotely) or a folder path (locally).

#### Option A: Remote Git Marketplace (Recommended)
Add the marketplace directly from your GitHub repository:
```bash
codex plugin marketplace add uset82/webdesigner
```

#### Option B: Local Marketplace (Development)
If you have cloned the project locally, add the local marketplace pointing to your project directory:
```bash
codex plugin marketplace add C:\Users\carlos\PROYECTOS\mentora\webdesigner
```

---

### 2. Configure Codex `config.toml`

Ensure that the WebDesigner plugin is enabled and the directory is trusted in your Codex configuration file.

Open your Codex configuration file (`~/.codex/config.toml` or `C:\Users\carlos\.codex\config.toml` on Windows) and apply the following settings:

#### Trust the Workspace Path
Under `[projects]`, add the path to the workspace directory so that Codex can execute commands and read files:
```toml
[projects.'C:\Users\carlos\PROYECTOS\mentora\webdesigner']
trust_level = "trusted"
```

#### Enable the Plugin
Ensure the plugin is explicitly enabled under `[plugins]`:
```toml
[plugins."webdesigner@webdesigner-repo-marketplace"]
enabled = true
```

*Note: Since the marketplace lists the plugin as `INSTALLED_BY_DEFAULT`, once the marketplace is added and the plugin is enabled, Codex will install and cache the files automatically.*

---

### 3. Restart Codex

To apply the changes, restart any active Codex app sessions or background CLI instances. You can verify that the plugin is active by checking the prompt debugging tools:

```bash
codex debug prompt-input
```

Look for `- WebDesigner Core: Web & App Design Orchestration` under the list of **Available plugins**.

---

## Project Structure

- `.codex-plugin/plugin.json`: Manifest file identifying the plugin, its skills, and its MCP server configuration.
- `.agents/plugins/marketplace.json`: Repo-scoped marketplace file pointing to the plugin source.
- `.antigravity/skills/`: Custom workflow skill modules used during orchestration (Stitch design, project scaffolder, security audit, code generator).
- `.antigravity/runtime/`: Active routing policy (`routing-policy.json`), provider registry (`provider-registry.json`), and stack schema definitions.
- `src/mcp/server.ts`: The TypeScript source code of the Model Context Protocol (MCP) server that exposes WebDesigner tools to Codex.
- `dist/`: Compiled JavaScript output executed by the node runtime.
