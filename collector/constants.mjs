import { MAX_EVENTS_PER_BATCH, MAX_EVENTS_PER_SOURCE, MAX_INGEST_BODY_BYTES } from '../lib/collector-limits.mjs';

export const ADAPTER_VERSION = 'library-loop-browser-v1';
export const DEFAULT_INGEST_URL = 'https://library-loop-60457.nilkamals463352.chatgpt.site/api/collector/ingest';
export const INGEST_TOKEN_ENV = 'LIBRARY_LOOP_INGEST_TOKEN';
export const INGEST_URL_ENV = 'LIBRARY_LOOP_INGEST_URL';
export const USER_AGENT_PRODUCT = 'LibraryLoopCollector';
export const USER_AGENT = `${USER_AGENT_PRODUCT}/1.0 (+https://library-loop-60457.nilkamals463352.chatgpt.site; low-frequency public event collection)`;
export const CHICAGO_TIME_ZONE = 'America/Chicago';
export const DEFAULT_WINDOW_DAYS = 60;
export const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
export const DEFAULT_SETTLE_MS = 1_500;
export const MAX_DESCRIPTION_LENGTH = 420;
export { MAX_EVENTS_PER_BATCH, MAX_EVENTS_PER_SOURCE, MAX_INGEST_BODY_BYTES };
