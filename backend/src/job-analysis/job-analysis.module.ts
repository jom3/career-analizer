import { Module } from '@nestjs/common';
import { CvImportModule } from '../cv-import/cv-import.module';
import { OpenaiModule } from '../openai/openai.module';
import { JobAnalysisController } from './job-analysis.controller';
import { JobAnalysisService } from './job-analysis.service';
import { JobParserService } from './job-parser.service';

@Module({
  imports: [OpenaiModule, CvImportModule],
  controllers: [JobAnalysisController],
  providers: [JobAnalysisService, JobParserService],
})
export class JobAnalysisModule {}
