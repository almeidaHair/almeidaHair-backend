import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';

export type Role = 'admin' | 'client';

export interface JwtUser {
  sub: string;
  email: string;
  name: string;
  role: Role;
  clientId?: string;
  jti: string;
  exp: number;
}

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: JwtUser;
  token?: string;
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

export const CurrentToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().token,
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      throw new UnauthorizedException('Sua sessão expirou. Entre novamente.');
    }

    try {
      const jwtUser = await this.jwt.verifyAsync<JwtUser>(token);
      const [revokedToken, databaseUser] = await Promise.all([
        this.prisma.revokedToken.findUnique({ where: { jti: jwtUser.jti } }),
        this.prisma.user.findUnique({
          where: { id: jwtUser.sub },
          include: { client: true },
        }),
      ]);

      if (revokedToken || !databaseUser) {
        throw new Error('Invalid session');
      }
      if (
        databaseUser.role === 'client' &&
        (!databaseUser.client || databaseUser.client.status !== 'ativo')
      ) {
        throw new UnauthorizedException('Seu acesso foi desativado.');
      }

      request.user = {
        ...jwtUser,
        email: databaseUser.email,
        name: databaseUser.name,
        role: databaseUser.role,
        clientId: databaseUser.clientId ?? undefined,
      };
      request.token = token;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Sua sessão expirou. Entre novamente.');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }
    return true;
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function assertClientAccess(user: JwtUser, clientId: string): void {
  if (user.role !== 'admin' && user.clientId !== clientId) {
    throw new ForbiddenException(
      'Você só pode acessar os seus próprios dados.',
    );
  }
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
