export const SOS_PAYLOAD_PREFIX = 'PA1|';

// Android advertising in this repo truncates manufacturer data to 20 bytes.
// Keep the payload tiny and deterministic so scanners can always decode it.
const MAX_BYTES = 20;

export function encodeSosPayload(userId: string): string {
  const safe = (userId || '').trim().replace(/\s+/g, '_');
  const raw = `${SOS_PAYLOAD_PREFIX}${safe}`;
  return raw.length > MAX_BYTES ? raw.slice(0, MAX_BYTES) : raw;
}

export function decodeSosPayload(raw: string): { userId?: string } {
  if (!raw) return {};
  if (!raw.startsWith(SOS_PAYLOAD_PREFIX)) return {};
  const userId = raw.slice(SOS_PAYLOAD_PREFIX.length).trim();
  return userId ? { userId } : {};
}

