import { HttpStatus } from '@nestjs/common';
import { CatalogueErrorCode } from '../constants/error-codes';
import { BaseAppException } from './base.exception';

type CatalogueItem = 'security' | 'sector' | 'index';

const NOT_FOUND: Record<CatalogueItem, CatalogueErrorCode> = {
  security: CatalogueErrorCode.SECURITY_NOT_FOUND,
  sector: CatalogueErrorCode.SECTOR_NOT_FOUND,
  index: CatalogueErrorCode.INDEX_NOT_FOUND,
};

const ALREADY_EXISTS: Record<CatalogueItem, CatalogueErrorCode> = {
  security: CatalogueErrorCode.SECURITY_ALREADY_EXISTS,
  sector: CatalogueErrorCode.SECTOR_ALREADY_EXISTS,
  index: CatalogueErrorCode.INDEX_ALREADY_EXISTS,
};

/** No security, sector or index with that code. */
export class CatalogueItemNotFoundError extends BaseAppException {
  constructor(item: CatalogueItem, code: string) {
    super(`Unknown ${item}: ${code}`, HttpStatus.NOT_FOUND, NOT_FOUND[item], {
      code,
    });
  }
}

/** A security, sector or index with that code is already in the catalogue. */
export class CatalogueItemAlreadyExistsError extends BaseAppException {
  constructor(item: CatalogueItem, code: string) {
    super(
      `A ${item} with code ${code} already exists`,
      HttpStatus.CONFLICT,
      ALREADY_EXISTS[item],
      { code },
    );
  }
}

/** A request refers to a sector that is not in the catalogue. */
export class UnknownSectorError extends BaseAppException {
  constructor(code: string) {
    super(
      `Unknown sector: ${code}`,
      HttpStatus.BAD_REQUEST,
      CatalogueErrorCode.SECTOR_NOT_FOUND,
      { code },
    );
  }
}
