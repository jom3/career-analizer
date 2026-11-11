import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { RequestWithUser } from '../../auth/request-with-user';
import {
  DocumentOwnerTable,
  ProfileFilesService,
  StoredFileContent,
} from './profile-files.service';
import {
  PROFILE_FILE_FIELD,
  profileFileUploadOptions,
} from './profile-file-upload.options';

@Controller('profile')
export class ProfileFilesController {
  constructor(private readonly profileFiles: ProfileFilesService) {}

  @Put('photo')
  @UseInterceptors(
    FileInterceptor(PROFILE_FILE_FIELD, profileFileUploadOptions),
  )
  uploadPhoto(
    @Req() req: RequestWithUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.profileFiles.setPhoto(req.user.id, requireFile(file).buffer);
  }

  @Get('photo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getPhoto(@Req() req: RequestWithUser): Promise<StreamableFile> {
    return toStreamable(await this.profileFiles.getPhoto(req.user.id));
  }

  @Delete('photo')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePhoto(@Req() req: RequestWithUser): Promise<void> {
    return this.profileFiles.deletePhoto(req.user.id);
  }

  @Put('education/:id/document')
  @UseInterceptors(
    FileInterceptor(PROFILE_FILE_FIELD, profileFileUploadOptions),
  )
  uploadEducationDocument(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploadDocument(req, 'education', id, file);
  }

  @Get('education/:id/document')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getEducationDocument(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    return this.getDocument(req, 'education', id);
  }

  @Delete('education/:id/document')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEducationDocument(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.profileFiles.deleteDocument(req.user.id, 'education', id);
  }

  @Put('certifications/:id/document')
  @UseInterceptors(
    FileInterceptor(PROFILE_FILE_FIELD, profileFileUploadOptions),
  )
  uploadCertificationDocument(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.uploadDocument(req, 'certification', id, file);
  }

  @Get('certifications/:id/document')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getCertificationDocument(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    return this.getDocument(req, 'certification', id);
  }

  @Delete('certifications/:id/document')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCertificationDocument(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.profileFiles.deleteDocument(req.user.id, 'certification', id);
  }

  private uploadDocument(
    req: RequestWithUser,
    table: DocumentOwnerTable,
    id: string,
    file?: Express.Multer.File,
  ) {
    const uploaded = requireFile(file);
    return this.profileFiles.setDocument(
      req.user.id,
      table,
      id,
      uploaded.buffer,
      uploaded.originalname,
    );
  }

  private async getDocument(
    req: RequestWithUser,
    table: DocumentOwnerTable,
    id: string,
  ): Promise<StreamableFile> {
    return toStreamable(
      await this.profileFiles.getDocument(req.user.id, table, id),
    );
  }
}

function requireFile(file?: Express.Multer.File): Express.Multer.File {
  if (!file) {
    throw new BadRequestException('El campo "file" es obligatorio.');
  }
  return file;
}

function toStreamable(content: StoredFileContent): StreamableFile {
  return new StreamableFile(content.buffer, {
    type: content.mimeType,
    disposition: 'inline',
  });
}
