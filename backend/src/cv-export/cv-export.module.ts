import { Module } from '@nestjs/common';
import { CvExportController } from './cv-export.controller';
import { CvExportService } from './cv-export.service';

@Module({
  controllers: [CvExportController],
  providers: [CvExportService],
})
export class CvExportModule {}
