import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InputType, OfferStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  MIME_TYPE_DOCX,
  MIME_TYPE_PDF,
  TextExtractorService,
  detectFileType,
} from '../cv-import/text-extractor.service';
import { JobOfferDto } from './dto/job-offer.dto';
import { JobParserService } from './job-parser.service';
import { JobOfferDraft, SourceLanguage } from './job-analysis.types';

export interface JobAnalysisResult {
  draft: JobOfferDraft;
  sourceLanguage: SourceLanguage;
  inputType: InputType;
  rawInput: string | null;
}

// Orquesta el análisis de ofertas: analiza texto, imagen o PDF con IA y
// expone el CRUD del historial del usuario. El archivo (imagen/PDF) solo
// impulsa el análisis y nunca se persiste.
@Injectable()
export class JobAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobParser: JobParserService,
    private readonly textExtractor: TextExtractorService,
  ) {}

  async analyze(
    text?: string,
    file?: Express.Multer.File,
  ): Promise<JobAnalysisResult> {
    if (!text && !file) {
      throw new BadRequestException(
        'Ingresá texto o subí una imagen, PDF o DOCX.',
      );
    }
    if (text && file) {
      throw new BadRequestException('Ingresá texto O un archivo, no ambos.');
    }

    if (text) {
      const trimmed = text.trim();
      if (!trimmed) {
        throw new BadRequestException('El texto está vacío.');
      }
      const { draft, sourceLanguage } = await this.jobParser.parseText(trimmed);
      return {
        draft,
        sourceLanguage,
        inputType: InputType.TEXT,
        rawInput: trimmed,
      };
    }

    const buffer = file!.buffer;
    const mimeType = file!.mimetype;

    if (mimeType.startsWith('image/')) {
      const { draft, sourceLanguage } = await this.jobParser.parseImage(
        buffer,
        mimeType,
      );
      return {
        draft,
        sourceLanguage,
        inputType: InputType.IMAGE,
        rawInput: null,
      };
    }

    const kind = detectFileType(buffer);
    if (!kind) {
      throw new BadRequestException(
        'Formato no soportado. Subí una imagen, PDF o DOCX.',
      );
    }
    const documentMime = kind === 'pdf' ? MIME_TYPE_PDF : MIME_TYPE_DOCX;
    const extracted = await this.textExtractor.extract(buffer, documentMime);
    const { draft, sourceLanguage } = await this.jobParser.parseText(extracted);
    return {
      draft,
      sourceLanguage,
      inputType: InputType.PDF,
      rawInput: extracted,
    };
  }

  async create(userId: string, dto: JobOfferDto) {
    return this.prisma.jobOffer.create({
      data: { userId, ...this.toData(dto) },
    });
  }

  async list(userId: string) {
    return this.prisma.jobOffer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(userId: string, id: string) {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id, userId },
    });
    if (!offer) {
      throw new NotFoundException('Oferta no encontrada.');
    }
    return offer;
  }

  async update(userId: string, id: string, dto: JobOfferDto) {
    await this.getById(userId, id);
    return this.prisma.jobOffer.update({
      where: { id },
      data: this.toData(dto),
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.prisma.jobOffer.delete({ where: { id } });
  }

  async updateStatus(userId: string, id: string, status: OfferStatus) {
    await this.getById(userId, id);
    return this.prisma.jobOffer.update({ where: { id }, data: { status } });
  }

  private toData(dto: JobOfferDto) {
    return {
      title: dto.title,
      company: dto.company ?? null,
      level: dto.level ?? null,
      responsibilities: dto.responsibilities ?? [],
      requiredSkills: dto.requiredSkills ?? [],
      preferredSkills: dto.preferredSkills ?? [],
      experienceYears: dto.experienceYears ?? null,
      experienceSummary: dto.experienceSummary ?? null,
      education: dto.education ?? [],
      languages: dto.languages ?? [],
      keywords: dto.keywords ?? [],
      sourceLanguage: dto.sourceLanguage ?? null,
      inputType: dto.inputType ?? InputType.TEXT,
      status: dto.status ?? OfferStatus.PENDING,
      rawInput: dto.rawInput ?? null,
    };
  }
}
