import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  normalizeText,
} from './common';
import { ChangePasswordDto, LoginDto, UpdateProfileDto } from './dto';
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

  @Patch('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Body() body: UpdateProfileDto,
    @CurrentUser() jwtUser: JwtUser,
    @CurrentToken() token: string,
  ) {
    const name = body.name.trim();
    const email = normalizeEmail(body.email);
    const emailOwner = await this.prisma.user.findFirst({
      where: { email, id: { not: jwtUser.sub } },
      select: { id: true },
    });

    if (emailOwner) {
      throw new BadRequestException({
        message: 'Revise os campos destacados.',
        fieldErrors: { email: 'Este e-mail já está em uso.' },
      });
    }

    let user: SessionUser;
    try {
      user = await this.prisma.$transaction(async (transaction) => {
        const updatedUser = await transaction.user.update({
          where: { id: jwtUser.sub },
          data: { name, email },
        });

        if (jwtUser.role === 'client') {
          if (!jwtUser.clientId) {
            throw new UnauthorizedException('Cadastro não encontrado.');
          }
          await transaction.client.update({
            where: { id: jwtUser.clientId },
            data: { name, email, searchName: normalizeText(name) },
          });
        }

        return updatedUser;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException({
          message: 'Revise os campos destacados.',
          fieldErrors: { email: 'Este e-mail já está em uso.' },
        });
      }
      throw error;
    }

    return this.session(token, user, jwtUser.exp * 1000);
  }

  @Patch('password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() jwtUser: JwtUser,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: jwtUser.sub },
      select: { passwordHash: true },
    });
    const validPassword = await argon2
      .verify(user.passwordHash, body.currentPassword)
      .catch(() => false);

    if (!validPassword) {
      throw new BadRequestException({
        message: 'Revise os campos destacados.',
        fieldErrors: { currentPassword: 'A senha atual está incorreta.' },
      });
    }

    await this.prisma.user.update({
      where: { id: jwtUser.sub },
      data: {
        passwordHash: await argon2.hash(body.newPassword, {
          type: argon2.argon2id,
        }),
      },
    });
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
