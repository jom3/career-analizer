import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/request-with-user';
import { CvExportQueryDto } from '../cv-export/dto/cv-export-query.dto';
import { CvExportService } from '../cv-export/cv-export.service';
import { sanitizeFilename, toCvDownload } from '../cv-export/cv-download';
import { applyCompactVisibility } from '../cv-export/cv-visibility';
import { CvPhotoService } from './cv-photo.service';

@Controller('cv-photo')
export class CvPhotoController {
  constructor(
    private readonly cvExportService: CvExportService,
    private readonly cvPhotoService: CvPhotoService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async download(
    @Req() req: RequestWithUser,
    @Query() query: CvExportQueryDto,
  ): Promise<StreamableFile> {
    const lang = query.lang ?? req.uiLang ?? 'es';
    const data = applyCompactVisibility(
      await this.cvExportService.loadCvData(req.user.id, lang),
    );
    const photo = await this.cvPhotoService.readPhoto(data);
    const buffer =
      query.format === 'pdf'
        ? await this.cvPhotoService.buildPdf(data, lang, photo)
        : await this.cvPhotoService.buildDocx(data, lang, photo);

    return toCvDownload(
      query.format,
      buffer,
      `${sanitizeFilename(data.name)}-CV-foto`,
    );
  }
}
