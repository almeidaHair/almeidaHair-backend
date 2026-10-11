import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import {
  CurrentToken,
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  normalizeEmail,
} from './common';
import { LoginDto } from './dto';
import { PrismaService } from './prisma.service';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'client';
  clientId: string | null;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private session(token: string, user: SessionUser, expiresAt: number) {
    return {
      token,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clientId: user.clientId ?? undefined,
      expiresAt,
    };
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(body.email) },
      include: { client: true },
    });
    const validPassword = user
      ? await argon2.verify(user.passwordHash, body.password).catch(() => false)
      : false;

    if (!user || !validPassword) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }
    if (
      user.role === 'client' &&
      (!user.client || user.client.status !== 'ativo')
    ) {
      throw new ForbiddenException(
        'Seu acesso está desativado. Entre em contato com o salão.',
      );
    }

    const jti = randomUUID();
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    const token = await this.jwt.signAsync(
      {
        email: user.email,
        name: user.name,
        role: user.role,
        clientId: user.clientId ?? undefined,
        jti,
      },
      { subject: user.id, expiresIn: '8h' },
    );

    return this.session(token, user, expiresAt);
  }

  @Get('session')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getSession(
    @CurrentUser() jwtUser: JwtUser,
    @CurrentToken() token: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: jwtUser.sub },
    });
    return this.session(token, user, jwtUser.exp * 1000);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: JwtUser): Promise<void> {
    await this.prisma.revokedToken.upsert({
      where: { jti: user.jti },
      create: { jti: user.jti, expiresAt: new Date(user.exp * 1000) },
      update: {},
    });
  }
}
