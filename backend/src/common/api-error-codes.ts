export type ApiErrorCode =
  'AI_UNAVAILABLE' | 'INVALID_INPUT' | 'OFFER_ALREADY_SAVED';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

// El frontend traduce `code`; `message` queda como respaldo para logs y
// clientes que todavía no mapean códigos.
export function apiError(code: ApiErrorCode, message: string): ApiErrorBody {
  return { code, message };
}
