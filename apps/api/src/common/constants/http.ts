export const TRACE_ID_HEADER = 'x-trace-id';
export const CLIENT_TYPE_HEADER = 'x-client-type';
export const CSRF_HEADER = 'x-csrf-token';
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** docs/rules/07-security.md C5 — an oversized body is rejected before parsing. */
export const JSON_BODY_LIMIT = '1mb';
