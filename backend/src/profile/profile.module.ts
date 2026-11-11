import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileTranslatorService } from './profile-translator.service';
import { ProfileFilesController } from './profile-files/profile-files.controller';
import { ProfileFilesService } from './profile-files/profile-files.service';
import { ProfileFileStorageService } from './profile-files/profile-file-storage.service';

@Module({
  controllers: [ProfileController, ProfileFilesController],
  providers: [
    ProfileService,
    ProfileTranslatorService,
    ProfileFilesService,
    ProfileFileStorageService,
  ],
  exports: [ProfileFileStorageService],
})
export class ProfileModule {}
