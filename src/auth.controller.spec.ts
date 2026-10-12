import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthController } from './auth.controller';
import type { JwtUser } from './common';
import { PrismaService } from './prisma.service';

jest.mock('argon2', () => ({
  argon2id: 2,
  verify: jest.fn(),
  hash: jest.fn(),
}));

const admin: JwtUser = {
  sub: 'u-admin',
  email: 'admin@almeidahair.com',
  name: 'Admin',
  role: 'admin',
  jti: 'token-id',
  exp: 2_000_000_000,
};

const client: JwtUser = {
  ...admin,
  sub: 'u-client',
  email: 'cliente@email.com',
  name: 'Cliente',
  role: 'client',
  clientId: 'c-client',
};

describe('AuthController account management', () => {
  const userUpdate = jest.fn();
  const clientUpdate = jest.fn();
  const findFirst = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const transaction = jest.fn((callback: (tx: unknown) => unknown) =>
    callback({ user: { update: userUpdate }, client: { update: clientUpdate } }),
  );
  const prisma = {
    user: { findFirst, findUniqueOrThrow, update: userUpdate },
    $transaction: transaction,
  } as unknown as PrismaService;
  const controller = new AuthController(prisma, {} as JwtService);

  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue(null);
    userUpdate.mockResolvedValue({
      id: admin.sub,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      clientId: null,
    });
    clientUpdate.mockResolvedValue({});
  });

  it('updates only the user for an administrator', async () => {
    userUpdate.mockResolvedValue({
      id: admin.sub,
      email: 'novo@email.com',
      name: 'Novo Admin',
      role: 'admin',
      clientId: null,
    });

    const session = await controller.updateProfile(
      { name: '  Novo Admin  ', email: ' NOVO@EMAIL.COM ' },
      admin,
      'token',
    );

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: admin.sub },
      data: { name: 'Novo Admin', email: 'novo@email.com' },
    });
    expect(clientUpdate).not.toHaveBeenCalled();
    expect(session).toMatchObject({
      token: 'token',
      name: 'Novo Admin',
      email: 'novo@email.com',
      expiresAt: admin.exp * 1000,
    });
  });

  it('synchronizes user and client account fields in one transaction', async () => {
    userUpdate.mockResolvedValue({
      id: client.sub,
      email: 'cliente.nova@email.com',
      name: 'Cliente Nova',
      role: 'client',
      clientId: client.clientId,
    });

    await controller.updateProfile(
      { name: 'Cliente Nova', email: 'cliente.nova@email.com' },
      client,
      'token',
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(clientUpdate).toHaveBeenCalledWith({
      where: { id: client.clientId },
      data: {
        name: 'Cliente Nova',
        email: 'cliente.nova@email.com',
        searchName: 'cliente nova',
      },
    });
  });

  it('rejects an email already owned by another account', async () => {
    findFirst.mockResolvedValue({ id: 'another-user' });

    await expect(
      controller.updateProfile(
        { name: 'Admin', email: 'usado@email.com' },
        admin,
        'token',
      ),
    ).rejects.toMatchObject({
      response: {
        fieldErrors: { email: 'Este e-mail já está em uso.' },
      },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an incorrect current password', async () => {
    findUniqueOrThrow.mockResolvedValue({ passwordHash: 'hash' });
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(
      controller.changePassword(
        { currentPassword: 'incorreta', newPassword: 'novaSenha123' },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('hashes the new password and keeps the current session valid', async () => {
    findUniqueOrThrow.mockResolvedValue({ passwordHash: 'old-hash' });
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    (argon2.hash as jest.Mock).mockResolvedValue('new-hash');

    await controller.changePassword(
      { currentPassword: 'senhaAtual', newPassword: 'novaSenha123' },
      admin,
    );

    expect(argon2.verify).toHaveBeenCalledWith('old-hash', 'senhaAtual');
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: admin.sub },
      data: { passwordHash: 'new-hash' },
    });
  });
});
