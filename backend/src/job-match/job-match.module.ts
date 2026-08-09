import { Module } from '@nestjs/common';
import { JobMatchController } from './job-match.controller';
import { JobMatchParserService } from './job-match-parser.service';
import { JobMatchService } from './job-match.service';

@Module({
  controllers: [JobMatchController],
  providers: [JobMatchService, JobMatchParserService],
})
export class JobMatchModule {}
