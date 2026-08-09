import { Module } from '@nestjs/common';
import { CvExportController } from './cv-export.controller';
import { CvExportService } from './cv-export.service';
import { CvSkillGroupingService } from './cv-skill-grouping.service';

@Module({
  controllers: [CvExportController],
  providers: [CvExportService, CvSkillGroupingService],
  exports: [CvExportService],
})
export class CvExportModule {}
