import { Module } from '@nestjs/common';
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
      }),
    }),
    OpenaiModule,
    PrismaModule,
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
export class AppModule {}
