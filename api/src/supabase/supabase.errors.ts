import { InternalServerErrorException } from '@nestjs/common';

export function throwIfSupabaseError(error: unknown, context: string): void {
  if (!error) return;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  throw new InternalServerErrorException(`${context}: ${message}`);
}
