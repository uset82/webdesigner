import { vectorizeImageToSvg } from "./imageToSvg.js";

const [, , inputPath, workspaceRoot = process.cwd()] = process.argv;

if (!inputPath) {
  console.error("Usage: asset-pipeline <image-path> [workspace-root]");
  process.exitCode = 1;
} else {
  vectorizeImageToSvg({ inputPath, workspaceRoot })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
