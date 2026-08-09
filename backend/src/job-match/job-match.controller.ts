import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/request-with-user';
import { JobMatchRequestDto, type JobMatchDto } from './dto/job-match.dto';
import { JobMatchService } from './job-match.service';

@Controller('job-match')
export class JobMatchController {
  constructor(private readonly jobMatchService: JobMatchService) {}

  @Post()
  create(
    @Req() req: RequestWithUser,
    @Body() dto: JobMatchRequestDto,
  ): Promise<JobMatchDto> {
    const lang = dto.lang ?? 'es';
    if (dto.jobOfferId) {
      return this.jobMatchService.createForOffer(
        req.user.id,
        dto.jobOfferId,
        lang,
      );
    }
    return this.jobMatchService.createForDraft(
      req.user.id,
      dto.offer!,
      dto.saveOffer ?? false,
      lang,
    );
  }

  @Get()
  list(@Req() req: RequestWithUser): Promise<JobMatchDto[]> {
    return this.jobMatchService.list(req.user.id);
  }

  @Get(':id')
  get(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<JobMatchDto> {
    return this.jobMatchService.getById(req.user.id, id);
  }

  @Post(':id/recompute')
  recompute(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<JobMatchDto> {
    return this.jobMatchService.recompute(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.jobMatchService.remove(req.user.id, id);
  }
}
