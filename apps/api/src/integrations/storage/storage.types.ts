/**
 * The image types this deployment stores. Anything else is rejected before a
 * PUT is signed.
 *
 * One list on purpose: the content type is part of the signature and is checked
 * again against the stored object, so a second list would be a second place for
 * the browser's `accept` and the server's rule to drift apart.
 */
export const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

/** Extension per content type, so the stored key keeps a name a human can read. */
export const CONTENT_TYPE_EXTENSIONS: Record<ImageContentType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export interface SignedUpload {
  /** The key the caller sends back on confirmation. Never chosen by the client. */
  objectKey: string;
  /** Presigned PUT. Short-lived by design — it is a write grant. */
  url: string;
  /** Seconds until `url` stops working. */
  expiresIn: number;
  /** The exact header the browser has to send, or the signature will not match. */
  contentType: ImageContentType;
  /** The ceiling the confirmation step checks again against the stored object. */
  maxBytes: number;
}

export interface StoredObject {
  contentType: string | undefined;
  contentLength: number | undefined;
}
