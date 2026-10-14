/** Metadata plugin ghi vào frame (`figma_reconciliation_metadata`). */
export interface FrameMetadata {
  postId?: string;
  assetId?: string;
  version?: number;
  fingerprint?: string;
}

/** Một frame trên trang — `node` giữ nguyên để phía gọi đọc tiếp (serialize). */
export interface FrameInfo<N> {
  id: string;
  node: N;
  metadata: FrameMetadata | null;
}

/**
 * Chọn các frame thuộc bài đang sync (plans 09 §4.8, quyết định D1).
 *
 * Nhận frame khi và chỉ khi:
 * - có metadata `postId` trùng bài đang sync, hoặc
 * - chưa gắn bài (không metadata / `postId` rỗng) VÀ đang được chọn lúc Scan.
 * Frame nháp, ghi chú, frame bài khác không lọt vào bài nữa.
 *
 * Không nhập Post ID thì tự nhận từ frame đầu tiên có metadata, và KHÔNG nhận
 * frame chưa gắn bài (không biết gắn vào bài nào).
 *
 * `orderIndex` đếm trên danh sách ĐÃ LỌC, theo thứ tự canvas — không nhảy cóc
 * vì frame bị loại.
 */
export function selectPostFrames<N>(
  frames: FrameInfo<N>[],
  postId: string,
  selectedIds: string[],
): {
  postId: string;
  frames: (FrameInfo<N> & { orderIndex: number })[];
  skippedUnbound: number;
} {
  const explicit = !!postId;
  const effectivePostId = postId || frames.find((f) => f.metadata?.postId)?.metadata?.postId || '';
  const selected = new Set(selectedIds);
  const picked: (FrameInfo<N> & { orderIndex: number })[] = [];
  let skippedUnbound = 0;

  for (const frame of frames) {
    const framePostId = frame.metadata?.postId;
    if (framePostId) {
      if (framePostId === effectivePostId) picked.push({ ...frame, orderIndex: picked.length });
      continue;
    }
    if (explicit && selected.has(frame.id)) {
      picked.push({ ...frame, orderIndex: picked.length });
    } else {
      skippedUnbound++;
    }
  }

  return { postId: effectivePostId, frames: picked, skippedUnbound };
}
