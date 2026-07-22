import { Worker } from "node:worker_threads";
import type { VectorizePreview, VectorizeStage } from "@codex-avatar-studio/asset-pipeline";
import type { VectorizationWorkerMessage, VectorizationWorkerRequest } from "./vectorizationWorkerProtocol.js";

export type VectorizationRunner = (
  workerPath: string,
  request: VectorizationWorkerRequest,
  signal: AbortSignal,
  onProgress: (stage: VectorizeStage) => void
) => Promise<VectorizePreview>;

export const runVectorizationWorker: VectorizationRunner = (workerPath, request, signal, onProgress) => {
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { execArgv: ["--no-deprecation"], workerData: request });
    let settled = false;

    const cleanup = () => {
      signal.removeEventListener("abort", handleAbort);
      worker.removeAllListeners();
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      void worker.terminate();
      callback();
    };
    const handleAbort = () => finish(() => reject(createAbortError()));

    signal.addEventListener("abort", handleAbort, { once: true });
    worker.on("message", (message: VectorizationWorkerMessage) => {
      if (message.type === "progress") {
        onProgress(message.stage);
        return;
      }
      if (message.type === "result") {
        finish(() => resolve(message.preview));
        return;
      }

      const error = new Error(message.message);
      error.name = message.name;
      finish(() => reject(error));
    });
    worker.on("error", (error) => finish(() => reject(error)));
    worker.on("exit", (code) => {
      if (code !== 0) finish(() => reject(new Error(`Vectorization worker stopped with exit code ${code}.`)));
    });
  });
};

function createAbortError(): Error {
  const error = new Error("Image vectorization was cancelled.");
  error.name = "AbortError";
  return error;
}
