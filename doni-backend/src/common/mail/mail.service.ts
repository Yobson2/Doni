import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendMail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({ to, subject, template, context });
      this.logger.log(
        `Email sent to ${this.maskEmail(to)} (template: ${template})`,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to send email to ${this.maskEmail(to)}: ${err.message}`,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(user: {
    email: string;
    firstName?: string;
  }): Promise<void> {
    await this.sendMail(user.email, 'Welcome!', 'welcome', {
      firstname: user.firstName || 'there',
      appName: process.env.APP_NAME || 'Our App',
    });
  }

  async sendPasswordResetEmail(
    user: { email: string; firstName?: string },
    code: string,
  ): Promise<void> {
    await this.sendMail(user.email, 'Reset Your Password', 'password-reset', {
      firstname: user.firstName || 'there',
      code,
    });
  }

  async sendVerificationEmail(
    user: { email: string; firstName?: string },
    code: string,
  ): Promise<void> {
    await this.sendMail(user.email, 'Verify Your Email', 'verification', {
      firstname: user.firstName || 'there',
      code,
    });
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const masked =
      local.length <= 2
        ? '***'
        : `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`;
    return `${masked}@${domain}`;
  }
}
