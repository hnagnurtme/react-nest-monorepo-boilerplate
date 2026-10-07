import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const NO_ENVELOPE_KEY = 'noEnvelope';

/** Opts a route out of the `{ data }` envelope — 204s, streams, redirects. */
export const NoEnvelope = (): CustomDecorator => SetMetadata(NO_ENVELOPE_KEY, true);
