import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { OpenaiModule } from './openai/openai.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        OPENAI_API_KEY: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        CLIENT_ORIGIN: Joi.string().uri().default('http://localhost:4200'),
      }),
    }),
    OpenaiModule,
    PrismaModule,
    AuthModule,
    ProfileModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
