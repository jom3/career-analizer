import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/request-with-user';
import { ProfileDto } from './dto/profile.dto';
import { TranslateProfileDto } from './dto/translate-profile.dto';
import { ProfileService, type ProfileWithCollections } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  get(@Req() req: RequestWithUser): Promise<ProfileWithCollections> {
    return this.profileService.getForUser(req.user.id);
  }

  @Put()
  replace(
    @Req() req: RequestWithUser,
    @Body() dto: ProfileDto,
  ): Promise<ProfileWithCollections> {
    return this.profileService.replaceForUser(req.user.id, dto);
  }

  @Post('translate')
  @HttpCode(200)
  translate(
    @Req() req: RequestWithUser,
    @Body() dto: TranslateProfileDto,
  ): Promise<ProfileWithCollections> {
    return this.profileService.translateForUser(req.user.id, dto.lang, dto.from);
  }
}
