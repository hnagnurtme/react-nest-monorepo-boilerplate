import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ACTIONS, ROLE_SCOPES, SCOPE_PRESETS } from '@repo/shared-types';

type OpenApiSchema = Record<string, unknown>;

const GRANT_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['action', 'subject', 'preset'],
  properties: {
    action: { type: 'string', enum: ACTIONS },
    subject: { type: 'string' },
    preset: { type: 'string', enum: SCOPE_PRESETS },
  },
};

const ROLE_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['id', 'key', 'name', 'scope', 'isSystem', 'tenantId', 'permissions'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    key: { type: 'string' },
    name: { type: 'string' },
    scope: { type: 'string', enum: ROLE_SCOPES },
    isSystem: { type: 'boolean' },
    tenantId: { type: 'string', format: 'uuid', nullable: true },
    permissions: { type: 'array', items: GRANT_SCHEMA },
  },
};

const PERMISSION_OPTION_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['action', 'subject', 'description', 'presets'],
  properties: {
    action: { type: 'string' },
    subject: { type: 'string' },
    description: { type: 'string' },
    presets: { type: 'array', items: { type: 'string', enum: SCOPE_PRESETS } },
  },
};

const META_SCHEMA: OpenApiSchema = {
  type: 'object',
  required: ['page', 'limit', 'total', 'totalPages'],
  properties: {
    page: { type: 'integer' },
    limit: { type: 'integer' },
    total: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
};

export const ApiRoleResponse = (
  description: string,
  status: HttpStatus = HttpStatus.OK,
): MethodDecorator =>
  ApiResponse({
    status,
    description,
    schema: { type: 'object', required: ['data'], properties: { data: ROLE_SCHEMA } },
  });

export const ApiRoleListResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: {
      type: 'object',
      required: ['data', 'meta'],
      properties: { data: { type: 'array', items: ROLE_SCHEMA }, meta: META_SCHEMA },
    },
  });

export const ApiPermissionOptionsResponse = (description: string): MethodDecorator =>
  ApiResponse({
    status: HttpStatus.OK,
    description,
    schema: {
      type: 'object',
      required: ['data'],
      properties: { data: { type: 'array', items: PERMISSION_OPTION_SCHEMA } },
    },
  });
