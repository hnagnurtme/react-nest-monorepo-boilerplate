import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

type OpenApiSchema = Record<string, unknown>;

const USER_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: [
    'id',
    'email',
    'fullName',
    'phoneNumber',
    'roles',
    'tenantId',
    'isActive',
    'createdAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    fullName: { type: 'string' },
    phoneNumber: { type: 'string', nullable: true },
    roles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'key', 'name'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          key: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
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

export const ApiUserResponse = (
  description: string,
  status: HttpStatus = HttpStatus.OK,
): MethodDecorator =>
  ApiResponse({
    status,
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
