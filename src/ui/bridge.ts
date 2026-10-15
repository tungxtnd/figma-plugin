import { SandboxToUi, UiToSandbox } from '../shared/messages';

type Listener = (msg: SandboxToUi) => void;

const listeners = new Set<Listener>();

// MỘT bộ nhận duy nhất, gắn một lần. Trước đây `window.onmessage` bị gán lại mỗi
// lần state đổi và gửi lại `ui-ready`/`get-config` — ô Cài đặt bị reset sau mỗi job.
window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as SandboxToUi | undefined;
  if (!msg) return;
  for (const listener of listeners) listener(msg);
});

export function toSandbox(msg: UiToSandbox): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

export function onSandbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Chờ một message khớp điều kiện, có hạn giờ. */
export function waitForSandbox<T extends SandboxToUi>(
  match: (msg: SandboxToUi) => msg is T,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    const off = onSandbox((msg) => {
      if (match(msg)) {
        clearTimeout(timer);
        off();
        resolve(msg);
      }
    });
  });
}
