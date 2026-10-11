import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import {
  assertClientAccess,
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  normalizeEmail,
  normalizeText,
  Roles,
  RolesGuard,
} from './common';
import { CreateClientDto } from './dto';
import { PrismaService } from './prisma.service';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly prisma: PrismaService) {}

  private output(client: any, role: string) {
    const result = {
      ...client,
      lgpdConsentAt: client.lgpdConsentAt.toISOString(),
      createdAt: client.createdAt.toISOString(),
    };
    delete result.searchName;
    delete result.user;
    delete result.evaluations;
    if (role === 'client') result.notes = '';
    return result;
  }

  @Get()
  @Roles('admin')
  async list(@Query('query') query = '') {
    const clients = await this.prisma.client.findMany({
      where: query
        ? { searchName: { contains: normalizeText(query) } }
        : undefined,
      orderBy: { name: 'asc' },
      include: {
        evaluations: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true },
        },
      },
    });

    return clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      status: client.status,
      lastEvaluationDate: client.evaluations[0]?.date ?? null,
    }));
  }

  @Get('me')
  @Roles('client')
  async me(@CurrentUser() user: JwtUser) {
    const client = await this.prisma.client.findUnique({
      where: { id: user.clientId },
    });
    if (!client) throw new NotFoundException('Cadastro não encontrado.');
    return this.output(client, user.role);
  }

  @Get(':id')
  @Roles('admin', 'client')
  async one(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    assertClientAccess(user, id);
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Cliente não encontrada.');
    return this.output(client, user.role);
  }

  @Post()
  @Roles('admin')
  async create(@Body() body: CreateClientDto) {
    const email = normalizeEmail(body.email);
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new BadRequestException({
        message: 'Revise os campos destacados.',
        fieldErrors: { email: 'Este e-mail já está em uso.' },
      });
    }
    if (!body.lgpdConsent) {
      throw new BadRequestException({
        message: 'Revise os campos destacados.',
        fieldErrors: {
          lgpdConsent: 'É necessário registrar o consentimento da cliente.',
        },
      });
    }

    const id = `c-${randomBytes(6).toString('hex')}`;
    let client;
    try {
      client = await this.prisma.$transaction(async (transaction) => {
        const createdClient = await transaction.client.create({
          data: {
            id,
            name: body.name.trim(),
            searchName: normalizeText(body.name),
            birthDate: body.birthDate,
            phone: body.phone.trim(),
            email,
            instagram: body.instagram.trim(),
            address: body.address.trim(),
            howFound: body.howFound.trim(),
            usualProcedures: body.usualProcedures.trim(),
            preferences: body.preferences.trim(),
            notes: body.notes.trim(),
            firstVisit: body.firstVisit,
            status: body.status,
            lgpdConsentAt: new Date(),
          },
        });
        await transaction.user.create({
          data: {
            id: `u-${id}`,
            email,
            name: createdClient.name,
            role: 'client',
            clientId: id,
            passwordHash: await argon2.hash(body.password, {
              type: argon2.argon2id,
            }),
          },
        });
        return createdClient;
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

    return this.output(client, 'admin');
  }
}
