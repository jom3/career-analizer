import { Request } from 'express';
import type { TokenUser } from './auth.service';
import type { UiLang } from '../i18n/ui-lang';

export interface RequestWithUser extends Request {
  user: TokenUser;
  uiLang?: UiLang;
}
