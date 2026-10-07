import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { USER_ROLES } from '@repo/shared-types';

/** OpenAPI security-scheme name shared by protected auth operations and Swagger setup. */
export const ACCESS_TOKEN_SECURITY_SCHEME = 'access-token';

type OpenApiSchema = Record<string, unknown>;

const PUBLIC_USER_SCHEMA = {
  type: 'object',
  required: ['id', 'email', 'fullName', 'role'],
  properties: {
    id: { type: 'string' },
    email: { type: 'string', format: 'email' },
    fullName: { type: 'string' },
    role: { type: 'string', enum: USER_ROLES },
    tenantId: { type: 'string' },
  },
} as const satisfies OpenApiSchema;

const AUTH_BODY_SCHEMA = {
  type: 'object',
  required: ['accessToken', 'user'],
  properties: {
    accessToken: { type: 'string' },
    user: PUBLIC_USER_SCHEMA,
    refreshToken: { type: 'string' },
    csrfToken: { type: 'string' },
  },
} as const satisfies OpenApiSchema;

const REGISTER_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['email', 'message', 'expiresInSeconds'],
  properties: {
    email: { type: 'string', format: 'email' },
    message: { type: 'string' },
    expiresInSeconds: { type: 'integer' },
  },
} as const satisfies OpenApiSchema;

const VERIFY_EMAIL_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['user', 'message'],
  properties: {
    user: PUBLIC_USER_SCHEMA,
    message: {
      type: 'string',
    },
  },
} as const satisfies OpenApiSchema;

const RESEND_OTP_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['email', 'message', 'cooldownSeconds'],
  properties: {
    email: { type: 'string', format: 'email' },
    message: { type: 'string' },
    cooldownSeconds: { type: 'integer' },
  },
} as const satisfies OpenApiSchema;

function dataEnvelope(schema: OpenApiSchema): OpenApiSchema {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: schema,
    },
  };
}

export const ApiAuthBodyResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: dataEnvelope(AUTH_BODY_SCHEMA),
  });

export const ApiPublicUserResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: dataEnvelope(PUBLIC_USER_SCHEMA),
  });

export const ApiRegisterResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.CREATED,
    description,
    schema: dataEnvelope(REGISTER_RESPONSE_SCHEMA),
  });

export const ApiVerifyEmailResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: dataEnvelope(VERIFY_EMAIL_RESPONSE_SCHEMA),
  });

export const ApiResendOtpResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: dataEnvelope(RESEND_OTP_RESPONSE_SCHEMA),
  });

const FORGOT_PASSWORD_SCHEMA = {
  type: 'object',
  required: ['message', 'expiresInSeconds'],
  properties: {
    message: {
      type: 'string',
      example: 'If this email address exists in our system, a password reset code has been sent.',
    },
    expiresInSeconds: { type: 'integer', example: 300 },
  },
} as const satisfies OpenApiSchema;

const MESSAGE_ONLY_SCHEMA = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', example: 'Operation completed successfully.' },
  },
} as const satisfies OpenApiSchema;

export const ApiForgotPasswordResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: dataEnvelope(FORGOT_PASSWORD_SCHEMA),
  });

export const ApiMessageResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: dataEnvelope(MESSAGE_ONLY_SCHEMA),
  });
