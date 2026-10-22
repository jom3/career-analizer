import { Module } from '@nestjs/common';
import { JobAnalysisModule } from '../job-analysis/job-analysis.module';
import { JobMatchController } from './job-match.controller';
import { JobMatchParserService } from './job-match-parser.service';
import { JobMatchService } from './job-match.service';

@Module({
  imports: [JobAnalysisModule],
  controllers: [JobMatchController],
  providers: [JobMatchService, JobMatchParserService],
})
export class JobMatchModule {}
