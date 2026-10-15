import { RemoteDesign } from './api-types';

/**
 * Bài còn slide chưa dựng xong thì chưa gửi bản sửa được: thứ tự slide tính
 * theo vị trí trên canvas, mà slide chưa dựng thì chưa có mặt trên canvas —
 * gửi lúc này là đánh số lệch với hệ thống.
 */
export function syncBlockReason(remote: RemoteDesign[]): string | null {
  const waiting = remote.filter((r) => r.status === 'PENDING_RENDER' || r.status === 'RENDERING').length;
  if (waiting > 0) {
    return `Bài còn ${waiting} slide đang chờ dựng. Đợi dựng xong rồi bạn gửi bản sửa nhé.`;
  }
  const failed = remote.filter((r) => r.status === 'FAILED').length;
  if (failed > 0) {
    return `Bài có ${failed} slide dựng lỗi. Bấm "Thử lại" để dựng lại trước, rồi mới gửi bản sửa.`;
  }
  return null;
}

/** Thứ tự slide trên canvas có tăng dần không (slide chưa dựng được phép vắng). */
export function isAscending(indexes: number[]): boolean {
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] <= indexes[i - 1]) return false;
  }
  return true;
}
