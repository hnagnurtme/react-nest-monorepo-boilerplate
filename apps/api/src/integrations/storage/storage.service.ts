import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { AppConfig } from '@/config/index.js';
import { ServiceUnavailableError, UpstreamUnavailableError } from '@/core/errors/index.js';

import {
  CONTENT_TYPE_EXTENSIONS,
  type ImageContentType,
  type SignedUpload,
  type StoredObject,
} from './storage.types.js';

/**
 * The outbound adapter for S3-compatible object storage — MinIO locally, a
 * managed service in production. It lives in `integrations/` because `modules/`
 * may not import a network SDK directly (eslint-plugin-boundaries).
 *
 * **Files never pass through NestJS.** The API signs a PUT and the browser
 * uploads straight to the bucket, then calls back to confirm. Proxying a 2 MiB
 * image through an event loop that also answers telemetry is a cost with no
 * benefit, and a multipart body parser is a larger attack surface than a
 * signature with an expiry.
 *
 * **The bucket is private and stays private.** Reads are signed per request
 * with a short TTL, which is why only the object key is stored: a URL in a
 * column is stale the moment its signature expires.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client | null;

  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(StorageService.name);
    this.client = this.createClient();
  }

  /** False when the deployment has no bucket configured; callers answer 503. */
  get isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * The ceiling a signed upload carries. Read by the confirmation step too, so
   * the limit the browser was handed and the one enforced cannot drift apart.
   */
  get maxUploadBytes(): number {
    return this.config.storage.maxUploadBytes;
  }

  /**
   * How long a signed URL lasts. Read by callers that hand the TTL to a client
   * alongside the URL, so the two cannot disagree.
   */
  get presignTtlSeconds(): number {
    return this.config.storage.presignTtlSeconds;
  }

  onModuleDestroy(): void {
    this.client?.destroy();
  }

  /**
   * The key is built here, never accepted from the client: a caller that picks
   * its own path writes over another tenant's logo, and a signed PUT is a write
   * grant for exactly the key it names.
   */
  buildTenantLogoKey(tenantId: string, contentType: ImageContentType): string {
    return `${tenantLogoPrefix(tenantId)}${randomUUID()}.${CONTENT_TYPE_EXTENSIONS[contentType]}`;
  }

  async signUpload(objectKey: string, contentType: ImageContentType): Promise<SignedUpload> {
    const client = this.require();
    const { bucket, presignTtlSeconds, maxUploadBytes } = this.config.storage;

    // `ContentType` is part of the signature, so the browser must send the same
    // header. `ContentLength` is not signed by the presigner, which is why the
    // confirmation step re-reads the stored object instead of trusting it.
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    });

    const url = await this.call(() =>
      getSignedUrl(client, command, { expiresIn: presignTtlSeconds }),
    );

    return { objectKey, url, expiresIn: presignTtlSeconds, contentType, maxBytes: maxUploadBytes };
  }

  /** A signed GET, regenerated per response. Null for a key that is not there. */
  async signDownload(objectKey: string): Promise<string | null> {
    const client = this.require();
    const { bucket, presignTtlSeconds } = this.config.storage;
    const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });

    return this.call(() => getSignedUrl(client, command, { expiresIn: presignTtlSeconds }));
  }

  /**
   * What the confirmation step checks: that the object exists, and what it
   * actually is. Without this a caller could hand the API any key string and
   * have it stored, or upload a 4 GiB file under a signature that never carried
   * a size. Returns null when the key is absent.
   */
  async head(objectKey: string): Promise<StoredObject | null> {
    const client = this.require();
    const { bucket } = this.config.storage;

    try {
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      return { contentType: result.ContentType, contentLength: result.ContentLength };
    } catch (error: unknown) {
      if (isNotFound(error)) return null;
      throw this.wrap(error);
    }
  }

  /**
   * Best effort: a logo that was replaced is garbage, but failing the request
   * that replaced it would be worse — the database row is already correct.
   */
  async deleteQuietly(objectKey: string): Promise<void> {
    if (this.client === null) return;
    const { bucket } = this.config.storage;

    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    } catch (error: unknown) {
      this.logger.warn({ err: error, objectKey }, 'Could not delete an orphaned object');
    }
  }

  private createClient(): S3Client | null {
    const { endpoint, region, accessKey, secretKey, forcePathStyle } = this.config.storage;

    if (endpoint === undefined) {
      this.logger.warn('S3_ENDPOINT is blank — object storage is off, uploads will answer 503');
      return null;
    }

    if (accessKey === undefined || secretKey === undefined) {
      // Loud, and still off: half-configured storage that silently falls back
      // to the SDK's credential chain would reach for an IAM role nobody meant.
      this.logger.error('S3_ENDPOINT is set but S3_ACCESS_KEY/S3_SECRET_KEY are not');
      return null;
    }

    return new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
  }

  private require(): S3Client {
    if (this.client === null) {
      throw new ServiceUnavailableError('Object storage is not configured');
    }
    return this.client;
  }

  private async call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error: unknown) {
      throw this.wrap(error);
    }
  }

  private wrap(error: unknown): Error {
    this.logger.error({ err: error }, 'Object storage call failed');
    return new UpstreamUnavailableError('Object storage is unreachable');
  }
}

/**
 * Where a tenant's logos live.
 *
 * Exported as a prefix rather than a key because it is also the authorization
 * check on the way back in: a signed PUT grants exactly one key, so a key under
 * another tenant's prefix was never one this caller was handed.
 */
export function tenantLogoPrefix(tenantId: string): string {
  return `tenants/${tenantId}/logo/`;
}

/** S3 answers a missing key with 404 and either `NoSuchKey` or `NotFound`. */
function isNotFound(error: unknown): boolean {
  if (!(error instanceof S3ServiceException)) return false;
  return error.$metadata.httpStatusCode === 404;
}
