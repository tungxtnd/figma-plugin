import * as React from 'react';
import { ApiError } from '../services/api-client';
import { ClaimedJob, MyWork, RENDER_REASSIGNED, WorkPost } from '../shared/api-types';
import { ByteLru, sniffImage } from '../shared/image-bytes';
import { LogLevel, SandboxToUi, SectionState } from '../shared/messages';
import { Backend } from './backend';
import { onSandbox, toSandbox, waitForSandbox } from './bridge';

// ── Nhật ký ─────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
  detail?: string;
}

export type AddLog = (level: LogLevel, message: string, detail?: string) => void;

export function useLog(): { entries: LogEntry[]; add: AddLog } {
  const [entries, setEntries] = React.useState<LogEntry[]>([]);
  const seq = React.useRef(0);
  const add = React.useCallback<AddLog>((level, message, detail) => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setEntries((prev) => [{ id: ++seq.current, time, level, message, detail }, ...prev].slice(0, 100));
  }, []);

  React.useEffect(
    () =>
      onSandbox((msg) => {
        if (msg.type === 'log') add(msg.level, msg.message, msg.detail);
      }),
    [add],
  );

  return { entries, add };
}

// ── Canvas ──────────────────────────────────────────────────────────────────

export function useCanvas(): { sections: Map<string, SectionState>; selectedPostId: string | null } {
  const [sections, setSections] = React.useState<Map<string, SectionState>>(new Map());
  const [selectedPostId, setSelected] = React.useState<string | null>(null);

  React.useEffect(
    () =>
      onSandbox((msg) => {
        if (msg.type === 'canvas') setSections(new Map(msg.sections.map((s) => [s.postId, s])));
        if (msg.type === 'selection') setSelected(msg.postId);
      }),
    [],
  );

  return { sections, selectedPostId };
}

// ── Danh sách việc ─────────────────────────────────────────────────────────

const WORK_REFRESH_MS = 15_000;
const CLEANUP_MS = 60_000;

export function useWorkList(
  backend: Backend | null,
  sections: Map<string, SectionState>,
  log: AddLog,
  onAuthError: (err: ApiError) => void,
): { work: MyWork | null; refresh: () => void } {
  const [work, setWork] = React.useState<MyWork | null>(null);
  const previous = React.useRef<Map<string, WorkPost>>(new Map());

  const refresh = React.useCallback(async () => {
    if (!backend) return;
    try {
      const next = await backend.mine();
      notifyTransitions(previous.current, next.posts);
      previous.current = new Map(next.posts.map((p) => [p.postId, p]));
      setWork(next);
    } catch (err) {
      if (err instanceof ApiError && err.isAuth) return onAuthError(err);
      log('warning', 'Chưa tải được danh sách việc, plugin sẽ thử lại.', (err as Error).message);
    }
  }, [backend, log, onAuthError]);

  React.useEffect(() => {
    if (!backend) return;
    void refresh();
    const timer = setInterval(refresh, WORK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [backend, refresh]);

  // Dọn Section của bài đã đăng / đã loại / đã xoá.
  const sectionIds = React.useRef<string[]>([]);
  sectionIds.current = [...sections.keys()];
  React.useEffect(() => {
    if (!backend) return;
    const cleanup = async () => {
      try {
        const removable = await backend.canvasStatus(sectionIds.current);
        if (removable.length > 0) {
          toSandbox({ type: 'remove-sections', postIds: removable });
          log('info', `Đã dọn ${removable.length} bài đã đăng khỏi canvas.`);
        }
      } catch (err) {
        if (err instanceof ApiError && err.isAuth) return onAuthError(err);
      }
    };
    const first = setTimeout(cleanup, 3000);
    const timer = setInterval(cleanup, CLEANUP_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [backend, log, onAuthError]);

  return { work, refresh };
}

/** Bài vừa dựng xong cả bộ thì báo một câu, không báo từng slide. */
function notifyTransitions(before: Map<string, WorkPost>, after: WorkPost[]): void {
  if (before.size === 0) return; // lần tải đầu: không báo lại chuyện cũ
  for (const post of after) {
    const prev = before.get(post.postId);
    if (!prev) continue;
    const wasBuilding = prev.stage === 'QUEUED' || prev.stage === 'RENDERING';
    if (wasBuilding && post.stage === 'IN_REVIEW') {
      toSandbox({ type: 'notify', message: `Xong “${post.title}”, chờ duyệt trên web.` });
    }
    if (prev.stage !== 'FAILED' && post.stage === 'FAILED') {
      toSandbox({ type: 'notify', message: `“${post.title}” có slide dựng không được.`, error: true });
    }
  }
}

// ── Tự dựng slide ──────────────────────────────────────────────────────────

const IDLE_POLL_MS = 5_000;
const ERROR_BACKOFF_MS = 15_000;
const JOB_WATCHDOG_MS = 90_000;
const IMAGE_TIMEOUT_MS = 20_000;

const imageCache = new ByteLru(50 * 1024 * 1024);

export interface RunningJob {
  postId: string;
  title: string;
  orderIndex: number;
  slideCount: number;
}

export function useJobRunner(
  backend: Backend | null,
  enabled: boolean,
  log: AddLog,
  onDone: () => void,
  onAuthError: (err: ApiError) => void,
): RunningJob | null {
  const [running, setRunning] = React.useState<RunningJob | null>(null);

  // Hàm gọi lại đổi theo render; vòng lặp đọc qua ref để không phải khởi động lại.
  const callbacks = React.useRef({ log, onDone, onAuthError });
  callbacks.current = { log, onDone, onAuthError };

  React.useEffect(() => {
    if (!backend || !enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      let delay = IDLE_POLL_MS;
      try {
        const job = await backend.claimNext();
        // Đã nhận slide thì dựng cho xong kể cả khi vừa tắt — bỏ dở là slide nằm chờ 5 phút.
        if (job) {
          setRunning({ postId: job.postId, title: job.postTitle, orderIndex: job.orderIndex, slideCount: job.slideCount });
          await runOne(backend, job, callbacks.current.log);
          setRunning(null);
          callbacks.current.onDone();
          delay = 300;
        }
      } catch (err) {
        setRunning(null);
        if (err instanceof ApiError && err.isAuth) {
          callbacks.current.onAuthError(err);
          return; // dừng hẳn, không thử lại mỗi vài giây với mã đã hỏng
        }
        callbacks.current.log('warning', 'Không nhận được việc từ hệ thống, plugin sẽ thử lại.', (err as Error).message);
        delay = ERROR_BACKOFF_MS;
      }
      if (!stopped) timer = setTimeout(loop, delay);
    };

    void loop();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [backend, enabled]);

  return running;
}

async function runOne(backend: Backend, job: ClaimedJob, log: AddLog): Promise<void> {
  const label = `“${job.postTitle}” slide ${job.orderIndex + 1}/${job.slideCount}`;
  const payload = job.renderedPayload ?? {};
  const imageUrls: string[] = payload.imageUrls || payload.images || [];

  const [bg, logo, ...content] = await Promise.all([
    fetchImage(payload.backgroundUrl),
    fetchImage(payload.logoUrl),
    ...imageUrls.map((url) => fetchImage(url)),
  ]);
  const missingImages = [bg, logo, ...content].filter((r) => r.failed).map((r) => r.url);
  if (missingImages.length > 0) {
    log('warning', `${label}: ${missingImages.length} ảnh không tải được, slide vẫn dựng tiếp.`, missingImages.join('\n'));
  }

  toSandbox({
    type: 'render-job',
    job,
    images: content.filter((r) => r.bytes).map((r) => ({ url: r.url, bytes: r.bytes! })),
    bgBytes: bg.bytes ?? undefined,
    logoBytes: logo.bytes ?? undefined,
    missingImages,
  });

  type Outcome = Extract<SandboxToUi, { type: 'job-rendered' | 'job-failed' }>;
  const outcome: Outcome = await waitForSandbox(
    (m): m is Outcome => (m.type === 'job-rendered' || m.type === 'job-failed') && m.assetId === job.assetId,
    JOB_WATCHDOG_MS,
    'Quá 90 giây mà slide chưa dựng xong.',
  ).catch((err: Error) => ({ type: 'job-failed' as const, assetId: job.assetId, error: err.message }));

  if (outcome.type === 'job-failed') {
    log('error', `${label} dựng không được.`, outcome.error);
    await reportFailed(backend, job.assetId, outcome.error, log);
    return;
  }

  try {
    await backend.uploadResult(job.assetId, outcome.bytes, outcome.renderResult);
    log('success', `Đã dựng ${label}.`);
  } catch (err) {
    if (err instanceof ApiError && (err.code === RENDER_REASSIGNED || err.status === 404)) {
      log('info', `${label}: bài đã giao cho người khác hoặc đã dựng lại, bỏ qua slide này.`);
      return;
    }
    if (err instanceof ApiError && err.isAuth) throw err;
    const reason = `Gửi ảnh lên hệ thống không được: ${(err as Error).message}`;
    log('error', `${label} chưa gửi được.`, reason);
    await reportFailed(backend, job.assetId, reason, log);
  }
}

async function reportFailed(backend: Backend, assetId: string, error: string, log: AddLog): Promise<void> {
  try {
    await backend.reportFailed(assetId, error);
  } catch (err) {
    if (err instanceof ApiError && (err.code === RENDER_REASSIGNED || err.status === 404)) return;
    log('warning', 'Chưa báo được lỗi lên hệ thống, slide sẽ tự quay lại hàng sau 5 phút.', (err as Error).message);
  }
}

interface FetchedImage {
  url: string;
  bytes: Uint8Array | null;
  failed: boolean;
}

async function fetchImage(url?: string): Promise<FetchedImage> {
  if (!url) return { url: '', bytes: null, failed: false };
  const cached = imageCache.get(url);
  if (cached) return { url, bytes: cached, failed: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { url, bytes: null, failed: true };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!sniffImage(bytes)) return { url, bytes: null, failed: true };
    imageCache.set(url, bytes);
    return { url, bytes, failed: false };
  } catch (_) {
    return { url, bytes: null, failed: true };
  } finally {
    clearTimeout(timer);
  }
}
