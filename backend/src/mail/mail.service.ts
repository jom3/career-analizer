import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const subject = 'Password reset';
    const text = `Click the following link to reset your password:\n\n${resetUrl}\n\nThe link expires in 1 hour.`;

    if (!this.shouldSendSmtp()) {
      this.logger.warn(
        `[MAIL_DRIVER=log] Password reset link for ${email}:\n${resetUrl}`,
      );
      return;
    }

    try {
      const transporter = this.createTransporter();
      await transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM'),
        to: email,
        subject,
        text,
      });
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error}`);
    }
  }

  private shouldSendSmtp(): boolean {
    const driver = this.config.get<string>('MAIL_DRIVER');
    if (driver !== 'smtp') return false;
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    return Boolean(host && user && pass);
  }

  private createTransporter(): Transporter {
    return nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      secure: this.config.get<number>('SMTP_PORT') === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }
}
