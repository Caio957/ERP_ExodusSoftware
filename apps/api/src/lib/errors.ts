/**
 * Erros de aplicação tipados. O error-handler global converte estes em
 * respostas HTTP consistentes (Requisito 4.8).
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'APP_ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(404, `${resource} não encontrado`, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, message, 'CONFLICT', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(403, message, 'FORBIDDEN');
  }
}

export class BusinessError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, message, 'BUSINESS_RULE', details);
  }
}
