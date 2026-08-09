import { Module } from '@nestjs/common';
import { CvExportModule } from '../cv-export/cv-export.module';
import { CvAdaptationController } from './cv-adaptation.controller';
import { CvAdaptationParserService } from './cv-adaptation-parser.service';
import { CvAdaptationService } from './cv-adaptation.service';

@Module({
  imports: [CvExportModule],
  controllers: [CvAdaptationController],
  providers: [CvAdaptationService, CvAdaptationParserService],
})
export class CvAdaptationModule {}
