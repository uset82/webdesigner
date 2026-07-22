import { parentPort, workerData } from "node:worker_threads";
import { previewImageToSvg } from "@codex-avatar-studio/asset-pipeline";
import type { VectorizationWorkerMessage, VectorizationWorkerRequest } from "./vectorizationWorkerProtocol.js";

const request = workerData as VectorizationWorkerRequest;

if (!parentPort) {
  throw new Error("Vectorization worker requires a parent port.");
}

void previewImageToSvg({
  ...request,
  onProgress: (stage) => post({ type: "progress", stage })
})
  .then((preview) => post({ type: "result", preview }))
  .catch((error: unknown) =>
    post({
      type: "error",
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error)
    })
  );

function post(message: VectorizationWorkerMessage): void {
  parentPort?.postMessage(message);
}
