import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClientsController } from './clients.controller';
import { PrismaService } from './prisma.service';

const body = {
  name: '  Patrícia Álmeida  ',
  birthDate: '1990-03-12',
  phone: '  (11) 99999-0000  ',
  email: ' PATRICIA@EMAIL.COM ',
  instagram: '  @patricia  ',
  address: '  Rua das Flores  ',
  howFound: '  Indicação  ',
  usualProcedures: '  Corte  ',
  preferences: '  Tarde  ',
  notes: '  Sensibilidade  ',
  firstVisit: '2026-10-01',
  status: 'ativo' as const,
};

const storedClient = {
  id: 'c-client',
  name: 'Patrícia Álmeida',
  searchName: 'patricia almeida',
  birthDate: body.birthDate,
  phone: '(11) 99999-0000',
  email: 'patricia@email.com',
  instagram: '@patricia',
  address: 'Rua das Flores',
  howFound: 'Indicação',
  usualProcedures: 'Corte',
  preferences: 'Tarde',
  notes: 'Sensibilidade',
  firstVisit: body.firstVisit,
  status: 'ativo',
  lgpdConsentAt: new Date('2026-09-01T12:00:00.000Z'),
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
};

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '6.16.3',
  });
}

describe('ClientsController update', () => {
  const clientUpdate = jest.fn();
  const userUpdate = jest.fn();
  const transaction = jest.fn((callback: (tx: unknown) => unknown) =>
    callback({ client: { update: clientUpdate }, user: { update: userUpdate } }),
  );
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const controller = new ClientsController(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    clientUpdate.mockResolvedValue(storedClient);
    userUpdate.mockResolvedValue({});
  });

  it('updates the client and linked account in one transaction', async () => {
    const result = await controller.update('c-client', body);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(clientUpdate).toHaveBeenCalledWith({
      where: { id: 'c-client' },
      data: {
        name: 'Patrícia Álmeida',
        searchName: 'patricia almeida',
        birthDate: body.birthDate,
        phone: '(11) 99999-0000',
        email: 'patricia@email.com',
        instagram: '@patricia',
        address: 'Rua das Flores',
        howFound: 'Indicação',
        usualProcedures: 'Corte',
        preferences: 'Tarde',
        notes: 'Sensibilidade',
        firstVisit: body.firstVisit,
        status: 'ativo',
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { clientId: 'c-client' },
      data: { name: 'Patrícia Álmeida', email: 'patricia@email.com' },
    });
    expect(result).toEqual({
      id: 'c-client',
      name: 'Patrícia Álmeida',
      birthDate: body.birthDate,
      phone: '(11) 99999-0000',
      email: 'patricia@email.com',
      instagram: '@patricia',
      address: 'Rua das Flores',
      howFound: 'Indicação',
      usualProcedures: 'Corte',
      preferences: 'Tarde',
      notes: 'Sensibilidade',
      firstVisit: body.firstVisit,
      status: 'ativo',
      lgpdConsentAt: '2026-09-01T12:00:00.000Z',
      createdAt: '2026-09-01T12:00:00.000Z',
    });
  });

  it('maps unique constraint errors to the email field', async () => {
    clientUpdate.mockRejectedValue(prismaError('P2002'));

    await expect(controller.update('c-client', body)).rejects.toMatchObject({
      response: {
        fieldErrors: { email: 'Este e-mail já está em uso.' },
      },
    });
    await expect(controller.update('c-client', body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns not found when the client or linked account does not exist', async () => {
    clientUpdate.mockRejectedValue(prismaError('P2025'));

    await expect(controller.update('missing', body)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
