import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { RequestWithUser } from '../auth/request-with-user';
import { CV_UPLOAD_FIELD, cvUploadOptions } from './cv-upload.options';
import { CvImportService, CvImportResult } from './cv-import.service';

@Controller('cv-import')
export class CvImportController {
  constructor(private readonly cvImportService: CvImportService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor(CV_UPLOAD_FIELD, cvUploadOptions))
  upload(
    @Req() req: RequestWithUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<CvImportResult> {
    if (!file) {
      throw new BadRequestException('El campo "file" es obligatorio.');
    }
    return this.cvImportService.importCv(req.user.id, file);
  }

  @Get(':id')
  getDocument(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.cvImportService.getDocument(req.user.id, id);
  }
}
