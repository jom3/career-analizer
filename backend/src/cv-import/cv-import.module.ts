import { Module } from '@nestjs/common';
import { OpenaiModule } from '../openai/openai.module';
import { AtsCheckService } from './ats-check.service';
import { CvImportController } from './cv-import.controller';
import { CvImportService } from './cv-import.service';
import { CvParserService } from './cv-parser.service';
import { TextExtractorService } from './text-extractor.service';

@Module({
  imports: [OpenaiModule],
  controllers: [CvImportController],
  providers: [
    TextExtractorService,
    CvParserService,
    AtsCheckService,
    CvImportService,
  ],
  exports: [TextExtractorService],
})
export class CvImportModule {}
