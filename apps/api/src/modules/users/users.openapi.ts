import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { USER_ROLES } from '@repo/shared-types';

type OpenApiSchema = Record<string, unknown>;

const USER_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['id', 'email', 'fullName', 'phoneNumber', 'role', 'tenantId', 'isActive', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    fullName: { type: 'string' },
    phoneNumber: { type: 'string', nullable: true },
    role: { type: 'string', enum: USER_ROLES },
    tenantId: { type: 'string', format: 'uuid', nullable: true },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const PAGINATION_META_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['page', 'limit', 'total', 'totalPages'],
  properties: {
    page: { type: 'integer' },
    limit: { type: 'integer' },
    total: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
};

export const ApiUserResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: { type: 'object', required: ['data'], properties: { data: USER_SCHEMA } },
  });

export const ApiUserListResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: {
      type: 'object',
      required: ['data', 'meta'],
      properties: { data: { type: 'array', items: USER_SCHEMA }, meta: PAGINATION_META_SCHEMA },
    },
  });
