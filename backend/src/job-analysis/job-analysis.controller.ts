import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { RequestWithUser } from '../auth/request-with-user';
import { JobOfferDto, UpdateOfferStatusDto } from './dto/job-offer.dto';
import { JobAnalysisResult, JobAnalysisService } from './job-analysis.service';
import { JOB_UPLOAD_FIELD, jobUploadOptions } from './job-upload.options';

@Controller('job-analysis')
export class JobAnalysisController {
  constructor(private readonly jobAnalysisService: JobAnalysisService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor(JOB_UPLOAD_FIELD, jobUploadOptions))
  analyze(
    @Req() req: RequestWithUser,
    @Body('text') text?: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<JobAnalysisResult> {
    return this.jobAnalysisService.analyze(text, file);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: JobOfferDto) {
    return this.jobAnalysisService.create(req.user.id, dto);
  }

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.jobAnalysisService.list(req.user.id);
  }

  @Get(':id')
  get(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.jobAnalysisService.getById(req.user.id, id);
  }

  @Put(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: JobOfferDto,
  ) {
    return this.jobAnalysisService.update(req.user.id, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferStatusDto,
  ) {
    return this.jobAnalysisService.updateStatus(req.user.id, id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.jobAnalysisService.remove(req.user.id, id);
  }
}
