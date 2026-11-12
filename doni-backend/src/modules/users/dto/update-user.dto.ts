import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DisplayCurrency } from '../entities/user.entity';

/** What a user may change on their own account. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Awa' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Traoré' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    enum: DisplayCurrency,
    enumName: 'DisplayCurrency',
    description: 'Currency to show amounts in (display only; XOF is stored)',
  })
  @IsOptional()
  @IsEnum(DisplayCurrency)
  displayCurrency?: DisplayCurrency;
}

/** What an admin may change on any account. */
export class UpdateUserDto extends UpdateProfileDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
