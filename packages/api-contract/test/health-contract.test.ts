import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getHealthPath } from '../src/index.js';

test('exposes the API health operation path', () => {
  assert.equal(getHealthPath(), '/healthz');
});

interface OpenApiOperation {
  security?: Array<Record<string, string[]>>;
  responses?: Record<string, OpenApiResponse>;
}

interface OpenApiSchema {
  $ref?: string;
  type?: string;
  required?: string[];
  properties?: Record<string, OpenApiSchema>;
  enum?: string[];
}

interface OpenApiResponse {
  content?: Record<string, { schema?: OpenApiSchema }>;
}

interface OpenApiDocument {
  components?: { schemas?: Record<string, OpenApiSchema> };
  paths: Record<string, { get?: OpenApiOperation; post?: OpenApiOperation }>;
}

test('declares bearer authentication for protected auth operations', async () => {
  const openApiPath = new URL('../openapi.json', import.meta.url);
  const document = JSON.parse(await readFile(openApiPath, 'utf8')) as OpenApiDocument;
  const bearerSecurity = [{ 'access-token': [] }];

  assert.deepEqual(document.paths['/api/v1/auth/me']?.get?.security, bearerSecurity);
  assert.deepEqual(document.paths['/api/v1/auth/logout-all']?.post?.security, bearerSecurity);
});

test('documents CSRF rejections from the login endpoint', async () => {
  const openApiPath = new URL('../openapi.json', import.meta.url);
  const document = JSON.parse(await readFile(openApiPath, 'utf8')) as OpenApiDocument;

  assert.ok(document.paths['/api/v1/auth/login']?.post?.responses?.['403']);
});

test('documents the login success envelope', async () => {
  const openApiPath = new URL('../openapi.json', import.meta.url);
  const document = JSON.parse(await readFile(openApiPath, 'utf8')) as OpenApiDocument;

  const schema =
    document.paths['/api/v1/auth/login']?.post?.responses?.['200']?.content?.['application/json']
      ?.schema;
  // Response schemas are components (generated from Zod), so follow the $ref.
  const loginResponse = schema?.$ref
    ? document.components?.schemas?.[schema.$ref.split('/').pop() ?? '']
    : schema;

  assert.equal(loginResponse?.type, 'object');
  assert.deepEqual(loginResponse.required, ['data']);
  assert.equal(loginResponse.properties?.['data']?.properties?.['accessToken']?.type, 'string');
  assert.equal(
    loginResponse.properties?.['data']?.properties?.['user']?.properties?.['email']?.type,
    'string',
  );
});
