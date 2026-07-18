import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.resolve(process.argv[2] || path.join(root, "dist/mcp/server.js"));
const child = spawn(process.execPath, [serverPath], {
  cwd: root,
  stdio: ["pipe", "pipe", "pipe"]
});

let nextId = 1;
let stdoutBuffer = "";
let stderr = "";
const pending = new Map();

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params = {}) {
  const id = nextId++;
  send({ jsonrpc: "2.0", id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk;
  let newline = stdoutBuffer.indexOf("\n");
  while (newline >= 0) {
    const line = stdoutBuffer.slice(0, newline).trim();
    stdoutBuffer = stdoutBuffer.slice(newline + 1);
    newline = stdoutBuffer.indexOf("\n");
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === undefined || !pending.has(message.id)) continue;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  }
});

const timeout = setTimeout(() => {
  child.kill();
  console.error(`MCP smoke test timed out. ${stderr}`);
  process.exit(1);
}, 10_000);

try {
  const initialized = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "webdesigner-smoke", version: "1.0.0" }
  });
  if (initialized?.serverInfo?.name !== "webdesigner-server") {
    throw new Error(`Unexpected server info: ${JSON.stringify(initialized?.serverInfo)}`);
  }

  send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  const listed = await request("tools/list");
  const names = listed?.tools?.map((tool) => tool.name).sort() || [];
  const expected = [
    "wd_add_artifact",
    "wd_get_best_model",
    "wd_get_status",
    "wd_intake_project",
    "wd_save_code_file"
  ];
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected tools: ${names.join(", ")}`);
  }

  console.log(`MCP smoke test passed for ${serverPath}: ${names.length} tools.`);
} finally {
  clearTimeout(timeout);
  child.stdin.end();
  child.kill();
}
