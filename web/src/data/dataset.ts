import type { Manifest, Volume } from '../types';
import { runWorker } from './worker-client';

const CACHE_LIMIT = 256 * 1024 * 1024;
const cache = new Map<string, Volume>();
let cacheBytes = 0;
export async function loadManifest(signal?: AbortSignal): Promise<Manifest> {
  const response = await fetch('/data/manifest.json', { signal });
  if (!response.ok)
    throw new Error('Dataset not prepared. Run the uv preparation command in the setup guide.');
  const value = (await response.json()) as Manifest;
  if (value.version !== 1 || !Array.isArray(value.cases) || !value.cases.length)
    throw new Error('Dataset manifest is empty or unsupported.');
  return value;
}
export async function loadVolume(
  url: string,
  signal: AbortSignal,
  progress?: (value: number) => void,
  labelMap?: Record<string, number>,
): Promise<Volume> {
  const key = `${url}:${JSON.stringify(labelMap)}`;
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    progress?.(1);
    return existing;
  }
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Volume unavailable (${response.status})`);
  const total = Number(response.headers.get('Content-Length'));
  let buffer: ArrayBuffer;
  if (response.body && progress) {
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) progress(Math.min(0.9, (received / total) * 0.9));
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    buffer = bytes.buffer;
  } else buffer = await response.arrayBuffer();
  signal.throwIfAborted();
  const volume = await runWorker<Volume>({ kind: 'decode', buffer, labelMap }, [buffer]);
  signal.throwIfAborted();
  cache.set(key, volume);
  cacheBytes += volume.data.byteLength;
  while (cacheBytes > CACHE_LIMIT && cache.size > 1) {
    const first = cache.keys().next().value!;
    cacheBytes -= cache.get(first)!.data.byteLength;
    cache.delete(first);
  }
  progress?.(1);
  return volume;
}
