import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App | null = null;
  private projectId: string;

  onModuleInit(): void {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      interface ServiceAccount {
        project_id: string;
        private_key: string;
        client_email: string;
      }
      let serviceAccount: ServiceAccount | null = null;
      let configSource: string;

      if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_PRIVATE_KEY &&
        process.env.FIREBASE_CLIENT_EMAIL
      ) {
        serviceAccount = {
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
        };
        configSource = 'environment variables';
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const decoded = Buffer.from(
          process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
          'base64',
        ).toString('utf-8');
        serviceAccount = JSON.parse(decoded) as ServiceAccount;
        configSource = 'base64-encoded service account';
      } else {
        const filePath = path.join(process.cwd(), 'serviceAccountKey.json');
        if (!fs.existsSync(filePath)) {
          this.logger.warn(
            'Firebase credentials not found. Firebase features are DISABLED.',
          );
          this.firebaseApp = null;
          return;
        }
        serviceAccount = JSON.parse(
          fs.readFileSync(filePath, 'utf8'),
        ) as ServiceAccount;
        configSource = 'serviceAccountKey.json';
      }

      if (
        !serviceAccount?.project_id ||
        !serviceAccount?.private_key ||
        !serviceAccount?.client_email
      ) {
        this.logger.warn(
          'Invalid Firebase config. Firebase features are DISABLED.',
        );
        this.firebaseApp = null;
        return;
      }

      this.projectId = serviceAccount.project_id;
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(
          serviceAccount as admin.ServiceAccount,
        ),
        projectId: this.projectId,
      });

      this.logger.log(`Firebase Admin SDK initialized (${configSource})`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      this.logger.error(
        `Failed to initialize Firebase: ${err.message ?? 'Unknown'}`,
      );
      this.firebaseApp = null;
    }
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.firebaseApp) {
      throw new UnauthorizedException('Firebase service is not available.');
    }

    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/id-token-expired') {
        throw new UnauthorizedException('Firebase token has expired');
      }
      throw new UnauthorizedException(
        `Token verification failed: ${err.message}`,
      );
    }
  }

  async sendPushNotification(
    deviceToken: string,
    payload: { title?: string; body?: string; data?: Record<string, string> },
    options?: { priority?: 'high' | 'normal'; ttl?: number },
  ): Promise<string> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized. Skipping push notification.');
      return 'firebase-disabled';
    }

    const message: admin.messaging.Message = {
      token: deviceToken,
      notification: payload.title
        ? { title: payload.title, body: payload.body || '' }
        : undefined,
      data: payload.data,
      android: {
        priority: options?.priority || 'high',
        ttl: options?.ttl ? options.ttl * 1000 : undefined,
      },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const messageId = await admin.messaging().send(message);
    this.logger.log(`Push notification sent. Message ID: ${messageId}`);
    return messageId;
  }

  async sendMulticastPushNotification(
    deviceTokens: string[],
    payload: { title?: string; body?: string; data?: Record<string, string> },
  ): Promise<{
    successCount: number;
    failureCount: number;
    failedTokens: string[];
  }> {
    if (!this.firebaseApp) {
      return {
        successCount: 0,
        failureCount: deviceTokens.length,
        failedTokens: deviceTokens,
      };
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: deviceTokens,
      notification: payload.title
        ? { title: payload.title, body: payload.body || '' }
        : undefined,
      data: payload.data,
    });

    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) failedTokens.push(deviceTokens[idx]);
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens,
    };
  }

  getFirebaseApp(): admin.app.App | null {
    return this.firebaseApp;
  }
}
