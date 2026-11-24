import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@common/constants/roles.constant';
import { MailService } from '@common/mail/mail.service';
import { User } from '@modules/users/entities/user.entity';

export interface HeldDayNotice {
  tradingDate: string;
  sourceUrl: string;
  headline: string;
  reasons: string[];
}

/**
 * Tells the admins about a BOC that needs them. A mail that cannot be sent
 * is logged and never undoes the ingestion: the held day is visible on the
 * admin review screen either way.
 */
@Injectable()
export class BocNotifier {
  private readonly logger = new Logger(BocNotifier.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mail: MailService,
  ) {}

  async notifyAdmins(notice: HeldDayNotice): Promise<void> {
    const admins = await this.users.find({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true, email: true },
    });
    for (const admin of admins) {
      try {
        await this.mail.sendMail(
          admin.email,
          `[Doni] BOC ${notice.tradingDate}: ${notice.headline}`,
          'boc-day-held',
          { ...notice },
        );
      } catch (error) {
        this.logger.error(
          `Could not tell an admin about the BOC of ${notice.tradingDate}: ${(error as Error).message}`,
        );
      }
    }
  }
}
