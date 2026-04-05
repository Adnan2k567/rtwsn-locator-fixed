export const getJitterDelay = (minMs: number = 150, maxMs: number = 1800): number =>
  Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

export const getSessionSeed = (): number =>
  (Date.now() % 97331) + 100;

export const MY_SESSION_JITTER_MS: number = getSessionSeed();
