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
import { CvPhotoService } from '../cv-photo/cv-photo.service';
import { CvDocumentedService } from './cv-documented.service';

@Controller('cv-documented')
export class CvDocumentedController {
  constructor(
    private readonly cvExportService: CvExportService,
    private readonly cvPhotoService: CvPhotoService,
    private readonly cvDocumentedService: CvDocumentedService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async download(
    @Req() req: RequestWithUser,
    @Query() query: CvExportQueryDto,
  ): Promise<StreamableFile> {
    const lang = query.lang ?? req.uiLang ?? 'es';
    const data = await this.cvExportService.loadCvData(req.user.id, lang);
    const photo = await this.cvPhotoService.readPhoto(data);
    const buffer =
      query.format === 'pdf'
        ? await this.cvDocumentedService.buildPdf(data, lang, photo)
        : await this.cvDocumentedService.buildDocx(data, lang, photo);

    return toCvDownload(
      query.format,
      buffer,
      `${sanitizeFilename(data.name)}-CV-documentado`,
    );
  }
}
