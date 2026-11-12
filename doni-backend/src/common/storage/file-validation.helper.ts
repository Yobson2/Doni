import { BadRequestException } from '@nestjs/common';

export const FILE_TYPE_CATEGORIES = {
  IMAGE: {
    name: 'image',
    mimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
    ],
    maxSize: 10 * 1024 * 1024,
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'],
  },
  VIDEO: {
    name: 'video',
    mimeTypes: [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
    ],
    maxSize: 500 * 1024 * 1024,
    extensions: ['mp4', 'mpeg', 'mov', 'avi', 'webm'],
  },
  AUDIO: {
    name: 'audio',
    mimeTypes: [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/aac',
    ],
    maxSize: 50 * 1024 * 1024,
    extensions: ['mp3', 'mpeg', 'wav', 'ogg', 'webm', 'aac'],
  },
  DOCUMENT: {
    name: 'document',
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
    maxSize: 20 * 1024 * 1024,
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'],
  },
  ANY: {
    name: 'any',
    mimeTypes: [] as string[],
    maxSize: 10 * 1024 * 1024,
    extensions: [] as string[],
  },
};

export type FileTypeCategory = keyof typeof FILE_TYPE_CATEGORIES;

export interface FileValidationOptions {
  allowedTypes?: FileTypeCategory[];
  maxSize?: number;
  customMimeTypes?: string[];
  allowAllTypes?: boolean;
  strictExtensionValidation?: boolean;
}

export class FileValidationHelper {
  private static categoryCache = new Map<string, FileTypeCategory | null>();

  static getCategoryFromMimeType(mimetype: string): FileTypeCategory | null {
    if (!mimetype) return null;
    const normalized = mimetype.toLowerCase();
    if (this.categoryCache.has(normalized))
      return this.categoryCache.get(normalized)!;

    for (const [category, config] of Object.entries(FILE_TYPE_CATEGORIES)) {
      if (config.mimeTypes.includes(normalized)) {
        const result = category as FileTypeCategory;
        this.categoryCache.set(normalized, result);
        return result;
      }
    }
    this.categoryCache.set(normalized, null);
    return null;
  }

  static validateMimeType(
    mimetype: string,
    options: FileValidationOptions = {},
  ): void {
    if (!mimetype) throw new BadRequestException('MIME type is required');
    if (options.allowAllTypes) return;

    const normalized = mimetype.toLowerCase();

    if (options.customMimeTypes?.length) {
      if (
        !options.customMimeTypes
          .map((t) => t.toLowerCase())
          .includes(normalized)
      ) {
        throw new BadRequestException(
          `File type '${mimetype}' is not allowed.`,
        );
      }
      return;
    }

    if (options.allowedTypes?.length) {
      const allowed: string[] = [];
      for (const cat of options.allowedTypes) {
        allowed.push(...FILE_TYPE_CATEGORIES[cat].mimeTypes);
      }
      if (allowed.length > 0 && !allowed.includes(normalized)) {
        throw new BadRequestException(
          `File type '${mimetype}' is not allowed.`,
        );
      }
    }
  }

  static validateFileSize(
    fileSize: number,
    mimetype: string,
    options: FileValidationOptions = {},
  ): void {
    if (fileSize === 0) throw new BadRequestException('File is empty');

    let maxSize: number;
    if (options.maxSize && options.maxSize > 0) {
      maxSize = options.maxSize;
    } else {
      const category = this.getCategoryFromMimeType(mimetype);
      maxSize = category
        ? FILE_TYPE_CATEGORIES[category].maxSize
        : FILE_TYPE_CATEGORIES.ANY.maxSize;
    }

    if (fileSize > maxSize) {
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
      throw new BadRequestException(
        `File size (${fileSizeMB}MB) exceeds maximum (${maxSizeMB}MB)`,
      );
    }
  }

  static validateFile(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
    options: FileValidationOptions = {},
  ): void {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new BadRequestException('Invalid or empty file');
    }
    this.validateMimeType(mimetype, options);
    this.validateFileSize(buffer.length, mimetype, options);
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(k)),
      sizes.length - 1,
    );
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  static isImage(mimetype: string): boolean {
    return mimetype
      ? FILE_TYPE_CATEGORIES.IMAGE.mimeTypes.includes(mimetype.toLowerCase())
      : false;
  }
}
