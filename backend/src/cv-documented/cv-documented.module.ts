import { Module } from '@nestjs/common';
import { CvExportModule } from '../cv-export/cv-export.module';
import { CvPhotoModule } from '../cv-photo/cv-photo.module';
import { ProfileModule } from '../profile/profile.module';
import { CvDocumentedController } from './cv-documented.controller';
import { CvDocumentedService } from './cv-documented.service';

@Module({
  imports: [CvExportModule, CvPhotoModule, ProfileModule],
  controllers: [CvDocumentedController],
  providers: [CvDocumentedService],
})
export class CvDocumentedModule {}
