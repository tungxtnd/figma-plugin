import { RenderStage, WorkPost } from './api-types';

export type Tone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

export type CardAction = 'view' | 'sync' | 'retry' | 'web' | 'log';

interface StageMeta {
  label: string;
  tone: Tone;
  rank: number;
}

/** Nhãn cùng cách gọi với web (bước Thiết kế), không lộ enum. */
const STAGES: Record<RenderStage, StageMeta> = {
  FAILED: { label: 'Có slide lỗi', tone: 'danger', rank: 0 },
  NEEDS_CHANGES: { label: 'Cần sửa', tone: 'warning', rank: 1 },
  RENDERING: { label: 'Đang dựng', tone: 'info', rank: 2 },
  QUEUED: { label: 'Chờ dựng', tone: 'neutral', rank: 3 },
  IN_REVIEW: { label: 'Chờ duyệt', tone: 'neutral', rank: 4 },
  APPROVED: { label: 'Đã duyệt', tone: 'success', rank: 5 },
};

export function stageMeta(stage: RenderStage): StageMeta {
  return STAGES[stage] ?? { label: 'Đang xử lý', tone: 'neutral', rank: 9 };
}

/** Dòng mô tả dưới tên bài. */
export function describePost(post: WorkPost): string {
  const { total, rendered, failed } = post.slides;
  switch (post.stage) {
    case 'FAILED':
      return post.lastError
        ? `${failed} slide dựng không được: ${post.lastError}`
        : `${failed} slide dựng không được.`;
    case 'NEEDS_CHANGES':
      return post.reviewNote ? `Góp ý: “${post.reviewNote}”` : 'Người duyệt yêu cầu sửa.';
    case 'RENDERING':
      return post.reviewNote
        ? `Đã dựng ${rendered}/${total} slide, theo góp ý: “${post.reviewNote}”`
        : `Đã dựng ${rendered}/${total} slide.`;
    case 'QUEUED':
      if (total === 0) return 'Đang chuẩn bị slide, xong là tự vào hàng.';
      return post.reviewNote
        ? `${total} slide đang xếp hàng dựng lại theo góp ý: “${post.reviewNote}”`
        : `${total} slide đang xếp hàng.`;
    case 'IN_REVIEW':
      return 'Đang chờ duyệt trên web.';
    case 'APPROVED':
      return 'Đã duyệt, chờ đăng.';
    default:
      return '';
  }
}

/**
 * Nút trên thẻ, theo việc người dùng cần làm. "Gửi bản sửa" chỉ hiện khi trên
 * canvas có chỗ sửa chưa gửi.
 */
export function cardActions(post: WorkPost, opts: { hasSection: boolean; dirty: boolean }): CardAction[] {
  const actions: CardAction[] = [];
  if (opts.hasSection) actions.push('view');
  if (opts.hasSection && opts.dirty) actions.push('sync');
  if (post.stage === 'FAILED') actions.push('retry', 'log');
  if (post.webUrl && (post.stage === 'IN_REVIEW' || post.stage === 'APPROVED' || post.stage === 'NEEDS_CHANGES')) {
    actions.push('web');
  }
  return actions;
}

/** Việc cần tay người lên đầu; cùng chặng thì bài có bản sửa chưa gửi lên trước. */
export function sortWork(posts: WorkPost[], dirty: ReadonlySet<string>): WorkPost[] {
  return [...posts].sort((a, b) => {
    const rank = stageMeta(a.stage).rank - stageMeta(b.stage).rank;
    if (rank !== 0) return rank;
    return Number(dirty.has(b.postId)) - Number(dirty.has(a.postId));
  });
}
