import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import {
  FileValidationHelper,
  FileValidationOptions,
} from './file-validation.helper';

export interface UploadFileOptions {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  validationOptions?: FileValidationOptions;
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicUrl: string;
  private readonly isConfigured: boolean;
  private readonly maxFileSize: number;
  private bucketVerified = false;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'S3_SECRET_ACCESS_KEY',
    );
    this.bucket = this.configService.get<string>('S3_BUCKET', 'app-storage');
    this.region = this.configService.get<string>('S3_REGION', 'us-east-1');
    this.maxFileSize = this.configService.get<number>(
      'MAX_FILE_SIZE',
      10 * 1024 * 1024,
    );
    const forcePathStyle =
      this.configService.get<string>('S3_FORCE_PATH_STYLE') === 'true';
    this.publicUrl = this.configService.get<string>(
      'S3_PUBLIC_URL',
      endpoint || '',
    );

    this.isConfigured = !!(endpoint && accessKeyId && secretAccessKey);

    if (!this.isConfigured) {
      this.logger.warn(
        'S3 storage is not fully configured. File operations will fail.',
      );
      this.s3Client = null;
      return;
    }

    try {
      this.s3Client = new S3Client({
        endpoint,
        region: this.region,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
        forcePathStyle,
      });
      this.logger.log(
        `Storage initialized - Bucket: ${this.bucket}, Region: ${this.region}`,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to initialize S3 client: ${err.message}`);
      this.s3Client = null;
    }
  }

  private ensureConfigured(): void {
    if (!this.isConfigured || !this.s3Client) {
      throw new BadRequestException('S3 storage is not configured.');
    }
  }

  private async ensureBucketExists(): Promise<void> {
    if (this.bucketVerified) return;
    this.ensureConfigured();

    const isMinIO = this.configService
      .get<string>('S3_ENDPOINT')
      ?.includes('minio');
    const isProduction = ['production', 'staging'].includes(
      this.configService.get<string>('NODE_ENV', 'development'),
    );

    try {
      await this.s3Client!.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketVerified = true;
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };

      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        if (isMinIO && !isProduction) {
          this.logger.warn(`Bucket ${this.bucket} not found, creating...`);
          await this.s3Client!.send(
            new CreateBucketCommand({ Bucket: this.bucket }),
          );
          await this.s3Client!.send(
            new PutBucketPolicyCommand({
              Bucket: this.bucket,
              Policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Principal: { AWS: ['*'] },
                    Action: ['s3:GetObject'],
                    Resource: [`arn:aws:s3:::${this.bucket}/*`],
                  },
                ],
              }),
            }),
          );
          this.bucketVerified = true;
        } else {
          throw new Error(
            `Bucket '${this.bucket}' not found. Create it manually.`,
            { cause: error },
          );
        }
      } else {
        throw error;
      }
    }
  }

  private sanitizePath(path: string): string {
    return path
      .replace(/\.\./g, '')
      .replace(/[<>:"|?*]/g, '')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/');
  }

  async uploadFile(
    folder: string,
    fileName: string,
    options: UploadFileOptions,
  ): Promise<UploadResult> {
    this.ensureConfigured();
    await this.ensureBucketExists();

    if (options.validationOptions || options.buffer) {
      FileValidationHelper.validateFile(
        options.buffer,
        options.mimetype,
        options.originalname || '',
        options.validationOptions || {
          allowAllTypes: true,
          maxSize: this.maxFileSize,
        },
      );
    }

    const key = `${this.sanitizePath(folder)}/${this.sanitizePath(fileName)}`;

    const upload = new Upload({
      client: this.s3Client!,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: options.buffer,
        ContentType: options.mimetype,
        ACL: 'public-read',
        Metadata: {
          originalName: options.originalname || fileName,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    await upload.done();
    const url = this.buildPublicUrl(key);
    this.logger.log(
      `File uploaded: ${key} (${FileValidationHelper.formatFileSize(options.buffer.length)})`,
    );
    return { key, url, bucket: this.bucket };
  }

  async downloadFile(key: string): Promise<Buffer> {
    this.ensureConfigured();
    if (!key) throw new BadRequestException('File key is required');

    const response = await this.s3Client!.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body || !(response.Body instanceof Readable))
      throw new Error('Empty response');

    const stream: Readable = response.Body;
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async deleteFile(key: string): Promise<void> {
    this.ensureConfigured();
    if (!key) throw new BadRequestException('File key is required');
    await this.s3Client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`File deleted: ${key}`);
  }

  async fileExists(key: string): Promise<boolean> {
    this.ensureConfigured();
    if (!key) return false;
    try {
      await this.s3Client!.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private buildPublicUrl(key: string): string {
    const forcePathStyle =
      this.configService.get<string>('S3_FORCE_PATH_STYLE') === 'true';
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    const cleanUrl = this.publicUrl.replace(/\/+$/, '');
    if (forcePathStyle) return `${cleanUrl}/${this.bucket}/${encodedKey}`;
    return `${cleanUrl}/${encodedKey}`;
  }

  generateFileName(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const parts = originalName.split('.');
    const ext =
      parts.length > 1 ? parts.pop()?.replace(/[^a-zA-Z0-9]/g, '') : 'bin';
    return prefix
      ? `${prefix}-${timestamp}-${random}.${ext}`
      : `${timestamp}-${random}.${ext}`;
  }
}
