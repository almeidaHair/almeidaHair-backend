import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import {
  assertClientAccess,
  CurrentUser,
  JwtAuthGuard,
  JwtUser,
  Roles,
  RolesGuard,
} from './common';
import { CreateEvaluationDto } from './dto';
import { PrismaService } from './prisma.service';

@ApiTags('evaluations')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private readonly prisma: PrismaService) {}

  private output(evaluation: any) {
    return {
      ...evaluation,
      createdAt: evaluation.createdAt.toISOString(),
    };
  }

  @Get('clients/:clientId/evaluations')
  @Roles('admin', 'client')
  async list(
    @Param('clientId') clientId: string,
    @CurrentUser() user: JwtUser,
  ) {
    assertClientAccess(user, clientId);
    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        clientId,
        ...(user.role === 'client' ? { sharedWithClient: true } : {}),
      },
      orderBy: { date: 'desc' },
    });
    return evaluations.map((evaluation) => this.output(evaluation));
  }

  @Post('clients/:clientId/evaluations')
  @Roles('admin')
  async create(
    @Param('clientId') clientId: string,
    @Body() body: CreateEvaluationDto,
    @CurrentUser() user: JwtUser,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrada.');

    const evaluation = await this.prisma.evaluation.create({
      data: {
        id: `e-${randomBytes(6).toString('hex')}`,
        clientId,
        date: body.date,
        sharedWithClient: body.sharedWithClient,
        hair: body.hair as unknown as Prisma.InputJsonValue,
        scalp: body.scalp as unknown as Prisma.InputJsonValue,
        history: body.history as unknown as Prisma.InputJsonValue,
        professional: body.professional as unknown as Prisma.InputJsonValue,
        authorName: user.name,
      },
    });
    return this.output(evaluation);
  }

  @Get('evaluations/:id')
  @Roles('admin', 'client')
  async one(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: { client: { select: { name: true } } },
    });
    const visibleToClient =
      evaluation &&
      evaluation.clientId === user.clientId &&
      evaluation.sharedWithClient;

    if (!evaluation || (user.role === 'client' && !visibleToClient)) {
      throw new NotFoundException('Avaliação não encontrada.');
    }

    const { client, ...result } = evaluation;
    return {
      ...this.output(result),
      clientName: client.name,
    };
  }
}
