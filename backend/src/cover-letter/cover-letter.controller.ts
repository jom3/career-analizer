import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/request-with-user';
import {
  CoverLetterExportQueryDto,
  type CoverLetterDto,
  type CoverLetterDraftDto,
  CreateCoverLetterDraftDto,
  CreateCoverLetterDto,
} from './dto/cover-letter.dto';
import { CoverLetterService } from './cover-letter.service';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Controller('cover-letter')
export class CoverLetterController {
  constructor(private readonly coverLetterService: CoverLetterService) {}

  @Post('draft')
  @HttpCode(HttpStatus.OK)
  buildDraft(
    @Req() req: RequestWithUser,
    @Body() dto: CreateCoverLetterDraftDto,
  ): Promise<CoverLetterDraftDto> {
    return this.coverLetterService.buildDraft(
      req.user.id,
      dto.jobOfferId,
      dto.recruiterName ?? null,
      dto.note ?? null,
    );
  }

  @Post()
  create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateCoverLetterDto,
  ): Promise<CoverLetterDto> {
    return this.coverLetterService.create(
      req.user.id,
      dto.jobOfferId,
      dto.recruiterName ?? null,
      dto.note ?? null,
      dto.content,
    );
  }

  @Get()
  list(@Req() req: RequestWithUser): Promise<CoverLetterDto[]> {
    return this.coverLetterService.list(req.user.id);
  }

  @Get(':id')
  get(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<CoverLetterDto> {
    return this.coverLetterService.getById(req.user.id, id);
  }

  @Get(':id/export')
  async export(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query() query: CoverLetterExportQueryDto,
  ): Promise<StreamableFile> {
    const { buffer, candidateName } =
      await this.coverLetterService.exportLetter(
        req.user.id,
        id,
        query.format,
        query.lang,
      );
    const slug =
      candidateName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'carta';
    const isPdf = query.format === 'pdf';
    return new StreamableFile(buffer, {
      type: isPdf ? 'application/pdf' : DOCX_MIME,
      disposition: `attachment; filename="${slug}-carta-de-motivacion.${query.format}"`,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.coverLetterService.remove(req.user.id, id);
  }
}
