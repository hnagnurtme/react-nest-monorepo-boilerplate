import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { USER_ROLES } from '@repo/shared-types';

/** OpenAPI security-scheme name shared by protected auth operations and Swagger setup. */
export const ACCESS_TOKEN_SECURITY_SCHEME = 'access-token';

type OpenApiSchema = Record<string, unknown>;

const PUBLIC_USER_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['id', 'email', 'fullName', 'role'],
  properties: {
    id: { type: 'string' },
    email: { type: 'string', format: 'email' },
    fullName: { type: 'string' },
    role: { type: 'string', enum: USER_ROLES },
    tenantId: { type: 'string' },
  },
};

const AUTH_BODY_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['accessToken', 'user'],
  properties: {
    accessToken: { type: 'string' },
    user: PUBLIC_USER_SCHEMA,
    refreshToken: { type: 'string' },
    csrfToken: { type: 'string' },
  },
};

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

const FORGOT_PASSWORD_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['message', 'expiresInSeconds'],
  properties: {
    message: {
      type: 'string',
      example: 'If this email address exists in our system, a password reset code has been sent.',
    },
    expiresInSeconds: { type: 'integer', example: 300 },
  },
};

const MESSAGE_ONLY_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', example: 'Operation completed successfully.' },
  },
};

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
