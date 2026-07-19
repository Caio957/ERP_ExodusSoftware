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
  // `code` é sobrescrevível para casos de 403 que o frontend precisa
  // diferenciar do bloqueio comum de RBAC por papel — ex.: `NO_TENANT`
  // (sessão sem empresa associada), que dispara logout automático no
  // cliente, ao contrário de um 403 de `authorize()` por papel (que só deve
  // exibir a mensagem de erro, sem deslogar ninguém).
  constructor(message = 'Acesso negado', code = 'FORBIDDEN') {
    super(403, message, code);
  }
}

export class BusinessError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, message, 'BUSINESS_RULE', details);
  }
}
