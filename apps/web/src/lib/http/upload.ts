/**
 * Sending a file to a presigned URL the API produced.
 *
 * It lives here rather than in a feature because `fetch` is banned outside
 * `lib/http` (rule D1) — and for once the reason is inverted: this request must
 * **not** carry our bearer token or CSRF header. It goes to the object store,
 * not to our API, the signature in the URL is the entire authorization, and an
 * `Authorization` header would be a credential sent to another origin.
 *
 * The content type has to match what the API signed, byte for byte, or the
 * store rejects the signature.
 */
export async function putSignedUpload(url: string, file: Blob, contentType: string): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
    // No cookies: this is a different origin and the URL is already signed.
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(`The object store refused the upload (${String(response.status)})`);
  }
}
