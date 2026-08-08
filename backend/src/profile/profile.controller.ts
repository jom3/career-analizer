import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { RequestWithUser } from '../auth/request-with-user';
import { ProfileDto } from './dto/profile.dto';
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
}
