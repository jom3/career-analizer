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
  AdaptedCvExportQueryDto,
  type AdaptedCvDto,
  CreateCvAdaptationDto,
} from './dto/cv-adaptation.dto';
import { CvAdaptationService } from './cv-adaptation.service';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Controller('cv-adaptation')
export class CvAdaptationController {
  constructor(private readonly adaptationService: CvAdaptationService) {}

  @Post()
  create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateCvAdaptationDto,
  ): Promise<AdaptedCvDto> {
    return this.adaptationService.createForOffer(
      req.user.id,
      dto.jobOfferId,
      dto.jobMatchId,
    );
  }

  @Get()
  list(@Req() req: RequestWithUser): Promise<AdaptedCvDto[]> {
    return this.adaptationService.list(req.user.id);
  }

  @Get(':id')
  get(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<AdaptedCvDto> {
    return this.adaptationService.getById(req.user.id, id);
  }

  @Get(':id/export')
  async export(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query() query: AdaptedCvExportQueryDto,
  ): Promise<StreamableFile> {
    const { buffer, candidateName } = await this.adaptationService.exportCv(
      req.user.id,
      id,
      query.format,
      query.lang,
    );
    const slug =
      candidateName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'cv';
    const isPdf = query.format === 'pdf';
    return new StreamableFile(buffer, {
      type: isPdf ? 'application/pdf' : DOCX_MIME,
      disposition: `attachment; filename="${slug}-CV-adaptado.${query.format}"`,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.adaptationService.remove(req.user.id, id);
  }
}
