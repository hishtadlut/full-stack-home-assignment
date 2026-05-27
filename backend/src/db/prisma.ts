import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type TransactionClient = Prisma.TransactionClient;

export const isRecordNotFoundError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

export const isForeignKeyConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
