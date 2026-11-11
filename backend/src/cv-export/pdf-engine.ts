import pdfMake from 'pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import { TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

const robotoFonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

interface PdfMakeServer {
  virtualfs: {
    existsSync(path: string): boolean;
    writeFileSync(path: string, content: string, encoding: string): void;
  };
  setFonts(fonts: Record<string, unknown>): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  setLocalAccessPolicy(callback: (path: string) => boolean): void;
  createPdf(doc: TDocumentDefinitions): TCreatedPdf;
}

const pdfMakeServer = pdfMake as unknown as PdfMakeServer;

let fontsLoaded = false;

function ensureFonts(): void {
  if (fontsLoaded) {
    return;
  }
  for (const [name, content] of Object.entries(vfsFonts)) {
    pdfMakeServer.virtualfs.writeFileSync(name, content, 'base64');
  }
  pdfMakeServer.setFonts(robotoFonts);
  pdfMakeServer.setUrlAccessPolicy(() => false);
  pdfMakeServer.setLocalAccessPolicy(() => false);
  fontsLoaded = true;
}

export async function renderPdf(doc: TDocumentDefinitions): Promise<Buffer> {
  ensureFonts();
  return pdfMakeServer.createPdf(doc).getBuffer();
}
