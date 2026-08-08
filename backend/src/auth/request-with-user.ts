import { Request } from 'express';
import type { TokenUser } from './auth.service';

export interface RequestWithUser extends Request {
  user: TokenUser;
}
