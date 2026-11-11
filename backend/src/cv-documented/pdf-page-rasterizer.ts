import { createCanvas } from '@napi-rs/canvas';

const RASTER_DPI = 150;
const POINTS_PER_INCH = 72;
const JPEG_QUALITY = 85;

export interface RasterPage {
  data: Buffer;
  width: number;
  height: number;
}

// pdf.js se carga bajo demanda: es un módulo ESM que no puede requerirse desde CJS.
export async function rasterizePdf(content: Buffer): Promise<RasterPage[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(content),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  try {
    const pages: RasterPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({
        scale: RASTER_DPI / POINTS_PER_INCH,
      });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: canvas.getContext(
          '2d',
        ) as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      pages.push({
        data: canvas.encodeSync('jpeg', JPEG_QUALITY),
        width: canvas.width,
        height: canvas.height,
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await document.destroy();
  }
}
