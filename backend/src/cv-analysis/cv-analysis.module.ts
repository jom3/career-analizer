import { Module } from '@nestjs/common';
import { CvAnalysisController } from './cv-analysis.controller';
import { CvAnalysisParserService } from './cv-analysis-parser.service';
import { CvAnalysisService } from './cv-analysis.service';

@Module({
  controllers: [CvAnalysisController],
  providers: [CvAnalysisService, CvAnalysisParserService],
})
export class CvAnalysisModule {}
