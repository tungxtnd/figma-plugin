/**
 * Bố cục canvas: mỗi bài một Section, slide xếp một hàng ngang trong Section.
 * Hàm thuần — sandbox gọi để đặt node, test gọi để kiểm.
 */

export const SECTION_PADDING = 80;
export const SLIDE_GAP = 80;
export const SECTION_GAP = 200;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Vị trí slide trong Section (toạ độ con của Section là tương đối với Section). */
export function slidePosition(orderIndex: number, slideWidth: number): { x: number; y: number } {
  return {
    x: SECTION_PADDING + Math.max(0, orderIndex) * (slideWidth + SLIDE_GAP),
    y: SECTION_PADDING,
  };
}

/** Kích thước Section ôm vừa mọi con, kèm lề. Không có con thì giữ cỡ một slide. */
export function sectionSizeFor(children: Box[], fallbackSlide: number): { width: number; height: number } {
  if (children.length === 0) {
    return {
      width: fallbackSlide + SECTION_PADDING * 2,
      height: fallbackSlide + SECTION_PADDING * 2,
    };
  }
  const right = Math.max(...children.map((c) => c.x + c.width));
  const bottom = Math.max(...children.map((c) => c.y + c.height));
  return {
    width: Math.ceil(right + SECTION_PADDING),
    height: Math.ceil(bottom + SECTION_PADDING),
  };
}

/** Section mới đặt dưới Section thấp nhất, thẳng mép trái với Section đầu tiên. */
export function nextSectionOrigin(existing: Box[]): { x: number; y: number } {
  if (existing.length === 0) return { x: 0, y: 0 };
  const left = Math.min(...existing.map((b) => b.x));
  const bottom = Math.max(...existing.map((b) => b.y + b.height));
  return { x: left, y: bottom + SECTION_GAP };
}

export function sectionName(title: string, postId: string): string {
  const clean = title.trim() || 'Bài chưa đặt tên';
  return `${clean} · ${postId.slice(0, 8)}`;
}

/**
 * Thứ tự slide theo canvas: trái sang phải, cùng cột thì trên xuống dưới.
 * Kéo đổi chỗ hai slide là đổi thứ tự trên hệ thống.
 */
export function orderByPosition<T extends { x: number; y: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
}
