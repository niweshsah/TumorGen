import type { WorkerRequest } from './volume.worker';

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
export function runWorker<T>(
  request:
    | Omit<Extract<WorkerRequest, { kind: 'decode' }>, 'id'>
    | Omit<Extract<WorkerRequest, { kind: 'metrics' }>, 'id'>
    | Omit<Extract<WorkerRequest, { kind: 'mesh' }>, 'id'>,
  transfer: Transferable[] = [],
): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./volume.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.error) job.reject(new Error(event.data.error));
      else job.resolve(event.data.value);
    };
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(new Error('Volume worker failed'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  const id = ++sequence;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    worker!.postMessage({ ...request, id }, transfer);
  });
}
