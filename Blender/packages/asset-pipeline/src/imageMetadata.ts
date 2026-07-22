import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export const MAX_TRACEABLE_IMAGE_BYTES = 32 * 1024 * 1024;

export type ImageMetadata = {
  width: number;
  height: number;
  format: "png" | "jpg" | "webp";
  hasAlpha: boolean | null;
};

export async function assertTraceableImageFile(inputPath: string): Promise<void> {
  const sourceStat = await lstat(inputPath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error("Choose a regular local picture file, not a folder or shortcut.");
  }
  if (sourceStat.size <= 0 || sourceStat.size > MAX_TRACEABLE_IMAGE_BYTES) {
    throw new Error(`Picture size must be between 1 byte and ${MAX_TRACEABLE_IMAGE_BYTES / (1024 * 1024)} MiB.`);
  }
}

export async function readImageMetadata(inputPath: string): Promise<ImageMetadata> {
  const buffer = await readFile(inputPath);
  const extension = path.extname(inputPath).toLowerCase();

  if (extension === ".png") {
    return readPngMetadata(buffer);
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return readJpegMetadata(buffer);
  }
  if (extension === ".webp") {
    return readWebpMetadata(buffer);
  }

  throw new Error("Unsupported image metadata format.");
}

export function assertTraceableImageMetadata(metadata: ImageMetadata): void {
  if (!Number.isFinite(metadata.width) || !Number.isFinite(metadata.height)) {
    throw new Error("Could not read image dimensions.");
  }

  if (metadata.width < 8 || metadata.height < 8) {
    throw new Error(
      `Image is too small to trace reliably (${metadata.width}x${metadata.height}). Use at least 8x8 pixels.`
    );
  }

  if (metadata.width * metadata.height > 16_000_000) {
    throw new Error(`Image is too large to trace safely (${metadata.width}x${metadata.height}). Resize it first.`);
  }
}

function readPngMetadata(buffer: Buffer): ImageMetadata {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Selected file is not a valid PNG.");
  }

  const colorType = buffer[25];

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    format: "png",
    hasAlpha: colorType === 4 || colorType === 6 || buffer.indexOf(Buffer.from("tRNS")) >= 0
  };
}

function readJpegMetadata(buffer: Buffer): ImageMetadata {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("Selected file is not a valid JPG.");
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      marker !== undefined &&
      ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb));

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
        format: "jpg",
        hasAlpha: false
      };
    }

    offset += 2 + length;
  }

  throw new Error("Could not read JPG dimensions.");
}

function readWebpMetadata(buffer: Buffer): ImageMetadata {
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error("Selected file is not a valid WebP.");
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType === "VP8X") {
    return {
      width: 1 + readUInt24LE(buffer, 24),
      height: 1 + readUInt24LE(buffer, 27),
      format: "webp",
      hasAlpha: Boolean((buffer[20] ?? 0) & 0x10)
    };
  }

  if (chunkType === "VP8 ") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
      format: "webp",
      hasAlpha: false
    };
  }

  if (chunkType === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      format: "webp",
      hasAlpha: null
    };
  }

  throw new Error("Could not read WebP dimensions.");
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer.readUIntLE(offset, 3);
}
