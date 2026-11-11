import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/request-with-user';
import { UiLang } from '../i18n/ui-lang';
import { CvExportQueryDto } from './dto/cv-export-query.dto';
import { CvExportService } from './cv-export.service';
import { sanitizeFilename, toCvDownload } from './cv-download';

@Controller('cv-export')
export class CvExportController {
  constructor(private readonly cvExportService: CvExportService) {}

  @Get()
  // El idioma viaja por el header Accept-Language y la URL no cambia, así que
  // las descargas nunca deben servirse desde caché.
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async download(
    @Req() req: RequestWithUser,
    @Query() query: CvExportQueryDto,
  ): Promise<StreamableFile> {
    const targetLang: UiLang = query.lang ?? req.uiLang ?? 'es';
    const data = await this.cvExportService.loadCvData(req.user.id, targetLang);
    const buffer =
      query.format === 'pdf'
        ? await this.cvExportService.buildPdf(data, targetLang)
        : await this.cvExportService.buildDocx(data, targetLang);

    return toCvDownload(
      query.format,
      buffer,
      `${sanitizeFilename(data.name)}-CV`,
    );
  }
}
