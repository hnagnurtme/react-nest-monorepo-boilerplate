import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

type OpenApiSchema = Record<string, unknown>;

const TENANT_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['id', 'name', 'slug', 'isActive', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    slug: { type: 'string' },
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

export const ApiTenantResponse = (
  description: string,
  status: HttpStatus = HttpStatus.OK,
): MethodDecorator =>
  ApiResponse({
    status,
    description,
    schema: { type: 'object', required: ['data'], properties: { data: TENANT_SCHEMA } },
  });

export const ApiTenantListResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: {
      type: 'object',
      required: ['data', 'meta'],
      properties: { data: { type: 'array', items: TENANT_SCHEMA }, meta: PAGINATION_META_SCHEMA },
    },
  });
