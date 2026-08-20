import { Controller, Get, Query, Req, StreamableFile } from '@nestjs/common';
import type { RequestWithUser } from '../auth/request-with-user';
import { UiLang } from '../i18n/ui-lang';
import { CvExportQueryDto } from './dto/cv-export-query.dto';
import { CvExportService } from './cv-export.service';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Controller('cv-export')
export class CvExportController {
  constructor(private readonly cvExportService: CvExportService) {}

  @Get()
  async download(
    @Req() req: RequestWithUser,
    @Query() query: CvExportQueryDto,
  ): Promise<StreamableFile> {
    const targetLang: UiLang = query.lang ?? req.uiLang ?? 'es';
    const data = await this.cvExportService.loadCvData(req.user.id, targetLang);
    const isPdf = query.format === 'pdf';
    const buffer = isPdf
      ? await this.cvExportService.buildPdf(data, targetLang)
      : await this.cvExportService.buildDocx(data, targetLang);

    const slug = this.sanitizeFilename(data.name) || 'cv';
    return new StreamableFile(buffer, {
      type: isPdf ? 'application/pdf' : DOCX_MIME,
      disposition: `attachment; filename="${slug}-CV.${query.format}"`,
    });
  }

  private sanitizeFilename(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  }
}
