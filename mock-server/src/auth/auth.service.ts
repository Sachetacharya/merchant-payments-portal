import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { RefreshTokenStore } from './refresh-token.store.js';
import { Role } from './role.enum.js';
import { UsersStore } from './users.store.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AccessTokenPayload {
  sub: string;
  name: string;
  role: Role;
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly usersStore: UsersStore,
    private readonly refreshTokens: RefreshTokenStore,
  ) {}

  async login(email: string, password: string): Promise<AuthTokens & { user: SafeUser }> {
    const user = this.usersStore.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.name, user.role);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = this.usersStore.findById(payload.sub);
    if (!user || !this.refreshTokens.consume(payload.sub, payload.jti)) {
      throw new UnauthorizedException('Refresh token has already been used or revoked');
    }

    return this.issueTokens(user.id, user.name, user.role);
  }

  logout(userId: string): void {
    this.refreshTokens.revokeAllForUser(userId);
  }

  private async issueTokens(userId: string, name: string, role: Role): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = { sub: userId, name, role };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: Number(this.config.get<string>('JWT_ACCESS_EXPIRES_IN')),
    });

    const tokenId = randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: userId, jti: tokenId };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: Number(this.config.get<string>('JWT_REFRESH_EXPIRES_IN')),
    });
    this.refreshTokens.save(userId, tokenId);

    return { accessToken, refreshToken };
  }
}
