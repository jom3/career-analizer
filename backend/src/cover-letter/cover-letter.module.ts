import { Module } from '@nestjs/common';
import { CoverLetterController } from './cover-letter.controller';
import { CoverLetterDocumentService } from './cover-letter-document.service';
import { CoverLetterParserService } from './cover-letter-parser.service';
import { CoverLetterService } from './cover-letter.service';

@Module({
  controllers: [CoverLetterController],
  providers: [
    CoverLetterService,
    CoverLetterParserService,
    CoverLetterDocumentService,
  ],
})
export class CoverLetterModule {}
