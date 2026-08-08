import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import { readFile, unlink } from 'fs/promises';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AtsCheckService } from './ats-check.service';
import { CvParserService } from './cv-parser.service';
import { AtsCheckItem, CvDraft, SourceLanguage } from './cv-import.types';
import { TextExtractorService } from './text-extractor.service';

export interface CvImportResult {
  documentId: string;
  draft: CvDraft;
  sourceLanguage: SourceLanguage;
  atsReport: AtsCheckItem[];
}

// Orquesta la importación: extrae el texto del archivo, lo parsea con IA,
// lo chequea contra criterios ATS y persiste el documento con su borrador.
@Injectable()
export class CvImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly textExtractor: TextExtractorService,
    private readonly cvParser: CvParserService,
    private readonly atsCheck: AtsCheckService,
  ) {}

  async importCv(
    userId: string,
    file: Express.Multer.File,
  ): Promise<CvImportResult> {
    try {
      const buffer = await readFile(file.path);
      const text = await this.textExtractor.extract(buffer, file.mimetype);
      const { draft, sourceLanguage } = await this.cvParser.parse(text);
      const atsReport = this.atsCheck.check(draft);
      const document = await this.prisma.cvDocument.create({
        data: {
          userId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          storagePath: path.join('uploads', file.filename),
          extractedText: text,
          sourceLanguage,
          model: this.cvParser.modelName,
          draftJson: draft as unknown as Prisma.InputJsonValue,
        },
      });
      return {
        documentId: document.id,
        draft,
        sourceLanguage,
        atsReport,
      };
    } catch (error) {
      await this.removeUploadedFile(file);
      throw error;
    }
  }

  async getDocument(userId: string, id: string) {
    const document = await this.prisma.cvDocument.findFirst({
      where: { id, userId },
    });
    if (!document) {
      throw new NotFoundException('Documento no encontrado.');
    }
    return document;
  }

  private async removeUploadedFile(file: Express.Multer.File): Promise<void> {
    if (!file?.filename) return;
    try {
      await unlink(file.path);
    } catch {
      // El archivo ya no existe o no pudo borrarse; no es un error crítico.
    }
  }
}
