export const supportedImageExtensions = [".png", ".jpg", ".jpeg"] as const;

export type SupportedImageExtension = (typeof supportedImageExtensions)[number];

export type VectorizeImageOptions = {
  inputPath: string;
  workspaceRoot: string;
  assetWorkspace?: string;
  outputBaseName?: string;
  threshold?: number;
  signal?: AbortSignal;
  onProgress?: (stage: VectorizeStage) => void;
  maxSvgBytes?: number;
  maxSvgPaths?: number;
  preprocessing?: RasterPreprocessingOptions;
};

export type VectorizeStage = "validating" | "decoding" | "preprocessing" | "tracing" | "optimizing";

export type RasterPreprocessingOptions = {
  grayscale?: boolean;
  threshold?: number;
  quantizationLevels?: 2 | 4 | 8 | 16;
  removeBackground?: boolean;
  noiseReduction?: number;
  detail?: "low" | "balanced" | "high";
};

export type VectorizePreview = {
  inputPath: string;
  exportDirectory: string;
  rawSvgPath: string;
  optimizedSvgPath: string;
  manifestPath: string;
  rawSvg: string;
  optimizedSvg: string;
  rawValidation: SvgValidationResult;
  optimizedValidation: SvgValidationResult;
  warnings: string[];
};

export type VectorizeImageResult = {
  inputPath: string;
  exportDirectory: string;
  rawSvgPath: string;
  optimizedSvgPath: string;
  manifestPath: string;
  warnings: string[];
};

export type SvgValidationResult = {
  valid: boolean;
  profile: SvgLayerProfile;
  warnings: string[];
  requiredLayers: string[];
  missingLayers: string[];
  unnamedGroups: number;
  tinyPathCount: number;
  pathCount: number;
  groupCount: number;
  byteLength: number;
};

export type SvgLayerProfile = "reference" | "humanoid" | "orb" | "mascot";

export type SvgValidationOptions = {
  profile?: SvgLayerProfile;
  maxBytes?: number;
  maxPaths?: number;
  tinyPathDataLength?: number;
  maxTinyPaths?: number;
};

export type AssetManifestEntry = {
  version: string;
  id: string;
  name: string;
  source: {
    type: "image-trace";
    path: string;
  };
  outputs: {
    rawSvg: string;
    optimizedSvg: string;
  };
  guidance: string;
  warnings: string[];
  createdAt: string;
};
