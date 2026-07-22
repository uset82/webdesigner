import type { RasterPreprocessingOptions, VectorizePreview, VectorizeStage } from "@codex-avatar-studio/asset-pipeline";

export type VectorizationWorkerRequest = {
  inputPath: string;
  workspaceRoot: string;
  outputBaseName: string;
  preprocessing: RasterPreprocessingOptions;
  maxSvgBytes: number;
  maxSvgPaths: number;
};

export type VectorizationWorkerMessage =
  | { type: "progress"; stage: VectorizeStage }
  | { type: "result"; preview: VectorizePreview }
  | { type: "error"; name: string; message: string };
