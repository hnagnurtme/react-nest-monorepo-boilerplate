import { type ApiError } from './client';

const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const BAD_REQUEST = 400;
const UNPROCESSABLE = 422;

export type ApiErrorKind = 'forbidden' | 'notFound' | 'conflict' | 'invalid' | 'unexpected';

/**
 * Classifies an API failure into the handful of kinds the UI words differently.
 * Kept free of i18n so it can be unit tested and reused by every feature; the
 * `useApiErrorMessage` hook turns a kind into a sentence.
 */
export function apiErrorKind(error: ApiError): ApiErrorKind {
  switch (error.status) {
    case FORBIDDEN:
      return 'forbidden';
    case NOT_FOUND:
      return 'notFound';
    case CONFLICT:
      return 'conflict';
    case BAD_REQUEST:
    case UNPROCESSABLE:
      return 'invalid';
    default:
      return 'unexpected';
  }
}
