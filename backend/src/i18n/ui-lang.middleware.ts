import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { resolveUiLang, UiLang } from './ui-lang';

declare module 'express-serve-static-core' {
  interface Request {
    uiLang?: UiLang;
  }
}

@Injectable()
export class UiLangMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    req.uiLang = resolveUiLang(req.headers['accept-language']);
    next();
  }
}
