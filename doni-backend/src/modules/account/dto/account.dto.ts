import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Deleting the account needs the current password again (ADR 0016). */
export class DeleteAccountDto {
  @ApiProperty({ description: 'The account’s current password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

/** Everything Doni holds about the signed-in user, as one JSON document. */
export class AccountExportDto {
  @ApiProperty({ example: 'doni-account-export' })
  format: string;

  @ApiProperty({ example: 1, description: 'Version of this export format' })
  version: number;

  @ApiProperty({ format: 'date-time' })
  exportedAt: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'One entry per kind of data, keyed by section: `account` (profile), ' +
      '`portfolios` (each portfolio with its whole ledger: buys, sells, ' +
      'opening positions and, once recorded, user dividends), `sessions`, ' +
      '`watchlist`. Modules added later (such as alert settings) add their ' +
      'own section. Amounts are XOF, as decimal strings.',
  })
  sections: Record<string, unknown>;
}
