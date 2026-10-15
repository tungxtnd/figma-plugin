import * as React from 'react';
import { ApiError } from '../services/api-client';
import { RemoteDesign } from '../shared/api-types';
import { computeDiff, describeCounts, DiffSummary, metadataFromResults, MetadataUpdate } from '../shared/diff';
import { SandboxToUi } from '../shared/messages';
import { syncBlockReason } from '../shared/sync-guard';
import { Backend, pngBlob } from './backend';
import { toSandbox, waitForSandbox } from './bridge';
import { AddLog } from './hooks';

export type SyncState =
  | { phase: 'checking' }
  | { phase: 'blocked'; message: string }
  | { phase: 'nothing'; message: string }
  | { phase: 'review'; diff: DiffSummary; summary: string; thumbs: { nodeId: string; url: string; label: string }[] }
  | { phase: 'sending' }
  | { phase: 'done'; message: string }
  | { phase: 'error'; message: string };

type Scanned = Extract<SandboxToUi, { type: 'section-scanned' }>;
type Exported = Extract<SandboxToUi, { type: 'frames-exported' }>;

let requestSeq = 0;

async function exportFrames(nodeIds: string[], scale: number): Promise<Map<string, Uint8Array>> {
  const requestId = `req-${++requestSeq}`;
  toSandbox({ type: 'export-frames', requestId, nodeIds, scale });
  const res = await waitForSandbox(
    (m): m is Exported => m.type === 'frames-exported' && m.requestId === requestId,
    120_000,
    'Xuất ảnh slide quá lâu.',
  );
  if (res.error) throw new Error(res.error);
  if (res.missing.length > 0) {
    throw new Error(`${res.missing.length} slide vừa bị xoá khỏi canvas. Bạn kiểm tra lại thay đổi rồi gửi lại nhé.`);
  }
  return new Map(res.exports.map((e) => [e.nodeId, e.bytes]));
}

/**
 * Gửi bản sửa của MỘT bài. `postId` chốt từ lúc mở — không bao giờ đọc lại từ
 * chỗ khác (trước đây Sync gửi vào bài mà auto-renderer vừa đổi sang).
 */
export function useSyncFlow(
  backend: Backend,
  postId: string,
  title: string,
  log: AddLog,
  onDone: () => void,
): { state: SyncState; confirm: () => void; recheck: () => void } {
  const [state, setState] = React.useState<SyncState>({ phase: 'checking' });
  const prepared = React.useRef<{ diff: DiffSummary; remote: RemoteDesign[] } | null>(null);
  const thumbUrls = React.useRef<string[]>([]);

  const releaseThumbs = () => {
    thumbUrls.current.forEach((u) => URL.revokeObjectURL(u));
    thumbUrls.current = [];
  };

  const check = React.useCallback(async () => {
    setState({ phase: 'checking' });
    releaseThumbs();
    try {
      toSandbox({ type: 'scan-section', postId });
      const [scanned, remote] = await Promise.all([
        waitForSandbox(
          (m): m is Scanned => m.type === 'section-scanned' && m.postId === postId,
          30_000,
          'Đọc canvas quá lâu.',
        ),
        backend.designs(postId),
      ]);

      const blocked = syncBlockReason(remote);
      if (blocked) return setState({ phase: 'blocked', message: blocked });

      const diff = computeDiff(scanned.slides, remote);
      prepared.current = { diff, remote };

      if (diff.changes.length === 0) {
        // Canvas khớp hệ thống: ghi lại fingerprint hiện tại để hết báo "chưa gửi".
        const byAsset = new Map(remote.map((r) => [r.assetId, r]));
        const updates: MetadataUpdate[] = scanned.slides
          .filter((s) => s.assetId && byAsset.has(s.assetId))
          .map((s) => ({
            figmaNodeId: s.figmaNodeId,
            postId,
            assetId: s.assetId!,
            version: byAsset.get(s.assetId!)!.version,
            fingerprint: s.fingerprint,
          }));
        toSandbox({ type: 'commit-sync', postId, updates });
        return setState({ phase: 'nothing', message: 'Canvas đã khớp với hệ thống, không có gì cần gửi.' });
      }

      const visual = diff.changes.filter((c) => c.action === 'CREATE' || c.action === 'UPDATE');
      const small = visual.length ? await exportFrames(visual.map((c) => c.figmaNodeId), 0.12) : new Map();
      const thumbs = visual.map((c) => {
        const url = URL.createObjectURL(pngBlob(small.get(c.figmaNodeId)!));
        thumbUrls.current.push(url);
        return {
          nodeId: c.figmaNodeId,
          url,
          label: c.action === 'CREATE' ? `Slide mới ${c.orderIndex + 1}` : `Slide ${c.orderIndex + 1}`,
        };
      });

      let summary = describeCounts(diff.counts);
      if (diff.stale + scanned.foreign > 0) {
        summary += `. Bỏ qua ${diff.stale + scanned.foreign} slide không thuộc bộ hiện tại của bài.`;
      }
      setState({ phase: 'review', diff, summary, thumbs });
    } catch (err) {
      setState({ phase: 'error', message: friendly(err) });
    }
  }, [backend, postId]);

  React.useEffect(() => {
    void check();
    return releaseThumbs;
  }, [check]);

  const confirm = React.useCallback(async () => {
    const ready = prepared.current;
    if (!ready) return;
    setState({ phase: 'sending' });
    try {
      const uploads = ready.diff.changes.filter((c) => c.fileFieldName);
      const full = uploads.length ? await exportFrames(uploads.map((c) => c.figmaNodeId), 2) : new Map();
      const result = await backend.sync(
        postId,
        ready.diff.changes,
        uploads.map((c) => ({ fieldName: c.fileFieldName!, bytes: full.get(c.figmaNodeId)! })),
      );
      toSandbox({ type: 'commit-sync', postId, updates: metadataFromResults(postId, ready.diff.changes, result.results) });
      toSandbox({ type: 'notify', message: `Đã gửi bản sửa “${title}”.` });
      log('success', `Đã gửi bản sửa “${title}”: ${describeCounts(ready.diff.counts)}.`);
      setState({ phase: 'done', message: 'Đã gửi. Slide mới hiện ngay trên web.' });
      onDone();
    } catch (err) {
      log('error', `Chưa gửi được bản sửa “${title}”.`, (err as Error).message);
      setState({ phase: 'error', message: friendly(err) });
    }
  }, [backend, postId, title, log, onDone]);

  return { state, confirm, recheck: check };
}

function friendly(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return 'Có người vừa gửi bản sửa khác cho bài này. Bạn bấm "Kiểm tra lại" rồi gửi lại nhé.';
    if (err.isAuth) return 'Mã kết nối không còn hiệu lực. Bạn lấy mã mới trên web nhé.';
    if (err.code === 'NETWORK_ERROR' || err.status === 408) return 'Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại.';
    return `Hệ thống báo: ${err.message}`;
  }
  return (err as Error)?.message || 'Lỗi không rõ.';
}
