export function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
  return bytesToHex(new Uint8Array(hashBuffer));
}

export async function hmac(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const dataBytes = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  return bytesToHex(new Uint8Array(signature));
}

export class CSPRNG {
  private seed: string;
  private counter: number;

  constructor(combinedSeed: string) {
    this.seed = combinedSeed;
    this.counter = 0;
  }

  async nextFloat(): Promise<number> {
    const hashHex = await hmac(this.seed, this.counter.toString());
    this.counter++;
    const first8Hex = hashHex.slice(0, 8);
    const uint32 = parseInt(first8Hex, 16);
    return uint32 / 0xffffffff;
  }

  async nextInt(min: number, max: number): Promise<number> {
    const float = await this.nextFloat();
    return Math.floor(float * (max - min + 1)) + min;
  }

  async nextDieFace(weights: [number, number, number, number, number, number]): Promise<1 | 2 | 3 | 4 | 5 | 6> {
    const float = await this.nextFloat();
    let cumulative = 0;
    for (let i = 0; i < 6; i++) {
      cumulative += weights[i] ?? 0;
      if (float < cumulative) return (i + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    }
    return 6;
  }

  reset(): void { this.counter = 0; }
  getCounter(): number { return this.counter; }
}

export async function generateServerSeed(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashServerSeed(seed: string): Promise<string> {
  return await sha256(seed);
}

export async function deriveCombinedSeed(serverSeed: string, clientSeeds: string[]): Promise<string> {
  const concatenated = serverSeed + clientSeeds.join('');
  return await sha256(concatenated);
}

export async function verifyServerSeed(revealed: string, commitment: string): Promise<boolean> {
  const recomputed = await sha256(revealed);
  if (recomputed.length !== commitment.length) return false;
  let diff = 0;
  for (let i = 0; i < recomputed.length; i++) {
    diff |= recomputed.charCodeAt(i) ^ commitment.charCodeAt(i);
  }
  return diff === 0;
}

export function generateClientSeed(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function seededRng(seed: number): () => number {
  let s = ((seed ^ 0xdeadbeef) >>> 0) || 1;
  return function (): number {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
