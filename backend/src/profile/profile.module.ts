import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileTranslatorService } from './profile-translator.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, ProfileTranslatorService],
})
export class ProfileModule {}
