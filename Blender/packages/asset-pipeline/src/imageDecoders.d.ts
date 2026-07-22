declare module "jimp" {
  class Jimp {
    public constructor(
      width: number,
      height: number,
      color: number,
      callback: (error: Error | null, image: Jimp) => void
    );

    public static read(inputPath: string): Promise<Jimp>;
    public bitmap: { width: number; height: number; data: Buffer };
    public greyscale(): this;
    public threshold(options: { max: number; replace: number; autoGreyscale: boolean }): this;
    public blur(radius: number): this;
    public setPixelColor(color: number, x: number, y: number): this;
    public quality(value: number): this;
    public writeAsync(outputPath: string): Promise<this>;
  }

  export default Jimp;
}

declare module "imagetracerjs" {
  const ImageTracer: {
    imagedataToSVG(
      image: { width: number; height: number; data: Uint8ClampedArray },
      options: Record<string, number | boolean>
    ): string;
  };

  export default ImageTracer;
}
