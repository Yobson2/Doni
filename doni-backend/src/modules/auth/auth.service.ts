import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  InvalidCredentialsError,
  InvalidTokenError,
} from '@common/exceptions/auth.exceptions';
import {
  getJWTRefreshSecret,
  JWT_EXPIRES_IN,
  JWT_REFRESH_TOKEN_EXPIRES_IN,
} from '@common/config/auth.config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    const tokens = this.generateTokens(user.id, user.role);
    this.logger.log(`User registered: ${user.id}`);
    return { user: user.toJSON(), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new InvalidCredentialsError();
    }

    const tokens = this.generateTokens(user.id, user.role);
    this.logger.log(`User logged in: ${user.id}`);
    return { user: user.toJSON(), ...tokens };
  }

  async refreshToken(refreshToken: string) {
    try {
      const refreshSecret = getJWTRefreshSecret(this.configService);
      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.usersService.findOne(payload.userId);
      const tokens = this.generateTokens(user.id, user.role);

      return { user: user.toJSON(), ...tokens };
    } catch {
      throw new InvalidTokenError('Invalid or expired refresh token');
    }
  }

  private generateTokens(userId: string, role: string) {
    const payload = { userId, role };
    const refreshSecret = getJWTRefreshSecret(this.configService);

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: JWT_EXPIRES_IN }),
      refreshToken: this.jwtService.sign(payload, {
        secret: refreshSecret,
        expiresIn: JWT_REFRESH_TOKEN_EXPIRES_IN,
      }),
    };
  }
}
