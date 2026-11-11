import { Module } from '@nestjs/common';
import { CvExportModule } from '../cv-export/cv-export.module';
import { ProfileModule } from '../profile/profile.module';
import { CvPhotoController } from './cv-photo.controller';
import { CvPhotoService } from './cv-photo.service';

@Module({
  imports: [CvExportModule, ProfileModule],
  controllers: [CvPhotoController],
  providers: [CvPhotoService],
  exports: [CvPhotoService],
})
export class CvPhotoModule {}
