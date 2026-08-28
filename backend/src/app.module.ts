import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CvAdaptationModule } from './cv-adaptation/cv-adaptation.module';
import { CvExportModule } from './cv-export/cv-export.module';
import { CvImportModule } from './cv-import/cv-import.module';
import { CoverLetterModule } from './cover-letter/cover-letter.module';
import { HealthController } from './health.controller';
import { I18nModule } from './i18n/i18n.module';
import { UiLangMiddleware } from './i18n/ui-lang.middleware';
import { JobAnalysisModule } from './job-analysis/job-analysis.module';
import { JobMatchModule } from './job-match/job-match.module';
import { OpenaiModule } from './openai/openai.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        OPENAI_API_KEY: Joi.string().required(),
        OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
        JWT_SECRET: Joi.string().min(32).required(),
        CLIENT_ORIGIN: Joi.string().uri().default('http://localhost:4200'),
        SMTP_HOST: Joi.string().allow('').default(''),
        SMTP_PORT: Joi.number().default(587),
        SMTP_USER: Joi.string().allow('').default(''),
        SMTP_PASS: Joi.string().allow('').default(''),
        SMTP_FROM: Joi.string().allow('').default(''),
        APP_URL: Joi.string().uri().default('http://localhost:4200'),
        MAIL_DRIVER: Joi.string().valid('log', 'smtp').default('log'),
      }),
    }),
    OpenaiModule,
    PrismaModule,
    I18nModule,
    AuthModule,
    ProfileModule,
    CvImportModule,
    CvExportModule,
    JobAnalysisModule,
    JobMatchModule,
    CvAdaptationModule,
    CoverLetterModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(UiLangMiddleware).forRoutes('*');
  }
}
