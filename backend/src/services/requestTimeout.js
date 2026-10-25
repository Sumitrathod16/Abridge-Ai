const configuredTimeout = process.env.AI_PROVIDER_TIMEOUT_MS;
const timeoutMs = configuredTimeout ? Number(configuredTimeout) : 30_000;

if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
  throw new Error('AI_PROVIDER_TIMEOUT_MS must be a positive integer.');
}

export function requestTimeoutSignal() {
  return AbortSignal.timeout(timeoutMs);
}
