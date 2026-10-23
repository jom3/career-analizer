import { Controller, Get, Req } from '@nestjs/common';
import type { RequestWithUser } from '../auth/request-with-user';
import { CvAnalysisService } from './cv-analysis.service';
import type { CvAnalysis } from './cv-analysis.types';

@Controller('cv-analysis')
export class CvAnalysisController {
  constructor(private readonly cvAnalysisService: CvAnalysisService) {}

  @Get()
  analyze(@Req() req: RequestWithUser): Promise<CvAnalysis> {
    return this.cvAnalysisService.analyze(req.user.id, req.uiLang ?? 'es');
  }
}
