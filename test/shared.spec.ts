import {
  nextSectionOrigin,
  orderByPosition,
  sectionName,
  sectionSizeFor,
  slidePosition,
  SECTION_GAP,
  SECTION_PADDING,
  SLIDE_GAP,
} from '../src/shared/layout';
import { computeDiff, describeCounts, metadataFromResults, CanvasSlide } from '../src/shared/diff';
import { ByteLru, sniffImage } from '../src/shared/image-bytes';
import { cardActions, describePost, sortWork, stageMeta } from '../src/shared/work';
import { RemoteDesign, WorkPost } from '../src/shared/api-types';

describe('layout', () => {
  it('slide xếp một hàng ngang trong Section, cách đều', () => {
    expect(slidePosition(0, 1080)).toEqual({ x: SECTION_PADDING, y: SECTION_PADDING });
    expect(slidePosition(2, 1080)).toEqual({ x: SECTION_PADDING + 2 * (1080 + SLIDE_GAP), y: SECTION_PADDING });
  });

  it('Section ôm vừa con kèm lề; rỗng thì cỡ một slide', () => {
    expect(sectionSizeFor([], 1080)).toEqual({ width: 1080 + 2 * SECTION_PADDING, height: 1080 + 2 * SECTION_PADDING });
    const kids = [0, 1, 2].map((i) => ({ ...slidePosition(i, 1080), width: 1080, height: 1080 }));
    const size = sectionSizeFor(kids, 1080);
    expect(size.width).toBe(SECTION_PADDING * 2 + 3 * 1080 + 2 * SLIDE_GAP);
    expect(size.height).toBe(1080 + 2 * SECTION_PADDING);
  });

  it('Section mới nằm dưới Section thấp nhất, thẳng mép trái', () => {
    expect(nextSectionOrigin([])).toEqual({ x: 0, y: 0 });
    expect(
      nextSectionOrigin([
        { x: 100, y: 0, width: 500, height: 400 },
        { x: 40, y: 600, width: 500, height: 300 },
      ]),
    ).toEqual({ x: 40, y: 900 + SECTION_GAP });
  });

  it('tên Section có tiêu đề và mã ngắn của bài', () => {
    expect(sectionName('5 mẹo SEO', 'abcdef12-3456')).toBe('5 mẹo SEO · abcdef12');
    expect(sectionName('  ', 'abcdef12-3456')).toBe('Bài chưa đặt tên · abcdef12');
  });

  it('thứ tự theo canvas: trái sang phải, cùng cột thì trên xuống', () => {
    const items = [
      { id: 'c', x: 400, y: 0 },
      { id: 'a', x: 0, y: 0 },
      { id: 'b2', x: 200, y: 300 },
      { id: 'b1', x: 200, y: 0 },
    ];
    expect(orderByPosition(items).map((i) => i.id)).toEqual(['a', 'b1', 'b2', 'c']);
  });
});

describe('computeDiff', () => {
  const remote = (over: Partial<RemoteDesign>): RemoteDesign => ({
    assetId: 'a',
    figmaNodeId: '1:1',
    fingerprint: 'fp',
    version: 2,
    orderIndex: 0,
    assetUrl: 'u',
    status: 'IN_REVIEW',
    ...over,
  });
  const slide = (over: Partial<CanvasSlide>): CanvasSlide => ({
    figmaNodeId: '1:1',
    assetId: 'a',
    version: 2,
    orderIndex: 0,
    fingerprint: 'fp',
    ...over,
  });

  it('không đổi gì thì không có thay đổi', () => {
    const d = computeDiff([slide({})], [remote({})]);
    expect(d.changes).toEqual([]);
    expect(d.unchanged).toBe(1);
  });

  it('frame mới không có metadata là CREATE, kèm tên trường file', () => {
    const d = computeDiff([slide({ assetId: undefined, figmaNodeId: '9:9', orderIndex: 3 })], []);
    expect(d.changes).toEqual([
      expect.objectContaining({ action: 'CREATE', assetId: null, orderIndex: 3, fileFieldName: 'slide_9:9' }),
    ]);
  });

  it('fingerprint đổi là UPDATE, gửi version frame đang giữ để server khoá lạc quan', () => {
    const d = computeDiff([slide({ fingerprint: 'new', version: 1 })], [remote({ version: 2 })]);
    expect(d.changes[0]).toMatchObject({ action: 'UPDATE', version: 1, fileFieldName: 'slide_1:1' });
  });

  it('chỉ đổi thứ tự là REORDER, không upload ảnh', () => {
    const d = computeDiff([slide({ orderIndex: 2 })], [remote({ orderIndex: 0 })]);
    expect(d.changes[0]).toMatchObject({ action: 'REORDER', orderIndex: 2 });
    expect(d.changes[0].fileFieldName).toBeUndefined();
  });

  it('chỉ đề xuất xoá slide ĐÃ DỰNG; slide chờ/đang dựng/lỗi không bao giờ bị xoá', () => {
    const d = computeDiff(
      [],
      [
        remote({ assetId: 'done', status: 'IN_REVIEW' }),
        remote({ assetId: 'approved', status: 'APPROVED' }),
        remote({ assetId: 'pending', status: 'PENDING_RENDER' }),
        remote({ assetId: 'rendering', status: 'RENDERING' }),
        remote({ assetId: 'failed', status: 'FAILED' }),
      ],
    );
    expect(d.changes.map((c) => [c.action, c.assetId])).toEqual([
      ['DELETE', 'done'],
      ['DELETE', 'approved'],
    ]);
  });

  it('frame mang assetId hệ thống không còn thì bỏ qua và đếm là cũ', () => {
    const d = computeDiff([slide({ assetId: 'gone' })], [remote({})]);
    expect(d.stale).toBe(1);
    expect(d.changes.filter((c) => c.action !== 'DELETE')).toEqual([]);
  });

  it('tóm tắt bằng lời', () => {
    expect(describeCounts({ CREATE: 1, UPDATE: 2, REORDER: 1, DELETE: 0 })).toBe(
      '2 slide đã sửa · 1 slide đổi thứ tự · 1 slide mới',
    );
    expect(describeCounts({ CREATE: 0, UPDATE: 0, REORDER: 0, DELETE: 0 })).toBe('Không có thay đổi nào');
  });

  it('metadata sau sync lấy assetId và version DO SERVER TRẢ', () => {
    const changes = computeDiff(
      [slide({ assetId: undefined, figmaNodeId: '9:9', fingerprint: 'n' }), slide({ fingerprint: 'u' })],
      [remote({}), remote({ assetId: 'old', status: 'APPROVED' })],
    ).changes;
    const updates = metadataFromResults('post-1', changes, [
      { assetId: 'srv-new', figmaNodeId: '9:9', action: 'CREATE', newVersion: 1, assetUrl: 'x' },
      { assetId: 'a', figmaNodeId: '1:1', action: 'UPDATE', newVersion: 3, assetUrl: 'y' },
      { assetId: 'old', figmaNodeId: '1:1', action: 'DELETE', newVersion: 0, assetUrl: null },
    ]);
    expect(updates).toEqual(
      expect.arrayContaining([
        { figmaNodeId: '9:9', postId: 'post-1', assetId: 'srv-new', version: 1, fingerprint: 'n' },
        { figmaNodeId: '1:1', postId: 'post-1', assetId: 'a', version: 3, fingerprint: 'u' },
      ]),
    );
  });
});

describe('ảnh', () => {
  it('nhận đúng PNG, JPEG, GIF; từ chối SVG, WebP, HTML', () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe('png');
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffImage(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39]))).toBe('gif');
    expect(sniffImage(new TextEncoder().encode('<svg xmlns='))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('RIFF....WEBP'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('<!DOCTYPE html>'))).toBeNull();
    expect(sniffImage(null)).toBeNull();
  });

  it('cache ảnh bỏ ảnh dùng lâu nhất khi vượt trần', () => {
    const lru = new ByteLru(10);
    lru.set('a', new Uint8Array(4));
    lru.set('b', new Uint8Array(4));
    lru.get('a'); // a mới dùng
    lru.set('c', new Uint8Array(4)); // vượt trần → bỏ b
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBeDefined();
    expect(lru.get('c')).toBeDefined();
    expect(lru.size).toBe(8);
  });

  it('ảnh to hơn cả trần thì không giữ', () => {
    const lru = new ByteLru(10);
    lru.set('big', new Uint8Array(20));
    expect(lru.get('big')).toBeUndefined();
    expect(lru.size).toBe(0);
  });
});

describe('thẻ việc', () => {
  const post = (over: Partial<WorkPost>): WorkPost => ({
    postId: 'p',
    title: 'T',
    webUrl: 'https://ui/posts/p',
    stage: 'QUEUED',
    slides: { total: 6, rendered: 0, failed: 0 },
    reviewNote: null,
    lastError: null,
    ...over,
  });

  it('nhãn bằng lời, không lộ enum', () => {
    expect(stageMeta('NEEDS_CHANGES').label).toBe('Cần sửa');
    expect(stageMeta('FAILED').tone).toBe('danger');
  });

  it('mô tả theo chặng', () => {
    expect(describePost(post({ stage: 'QUEUED' }))).toBe('6 slide đang xếp hàng.');
    expect(describePost(post({ stage: 'QUEUED', slides: { total: 0, rendered: 0, failed: 0 } }))).toMatch(/chuẩn bị/);
    expect(describePost(post({ stage: 'RENDERING', slides: { total: 6, rendered: 3, failed: 0 } }))).toBe(
      'Đã dựng 3/6 slide.',
    );
    expect(describePost(post({ stage: 'NEEDS_CHANGES', reviewNote: 'Đổi ảnh slide 2' }))).toBe(
      'Góp ý: “Đổi ảnh slide 2”',
    );
    expect(
      describePost(post({ stage: 'FAILED', slides: { total: 6, rendered: 5, failed: 1 }, lastError: 'Ảnh nền không tải được' })),
    ).toBe('1 slide dựng không được: Ảnh nền không tải được');
  });

  it('nút theo việc cần làm', () => {
    expect(cardActions(post({ stage: 'QUEUED' }), { hasSection: false, dirty: false })).toEqual([]);
    expect(cardActions(post({ stage: 'RENDERING' }), { hasSection: true, dirty: false })).toEqual(['view']);
    expect(cardActions(post({ stage: 'IN_REVIEW' }), { hasSection: true, dirty: true })).toEqual(['view', 'sync', 'web']);
    expect(cardActions(post({ stage: 'FAILED' }), { hasSection: true, dirty: false })).toEqual(['view', 'retry', 'log']);
    expect(cardActions(post({ stage: 'APPROVED', webUrl: null }), { hasSection: true, dirty: false })).toEqual(['view']);
  });

  it('việc cần tay người lên đầu, cùng chặng thì bài có bản sửa chưa gửi lên trước', () => {
    const list = [
      post({ postId: 'approved', stage: 'APPROVED' }),
      post({ postId: 'review-clean', stage: 'IN_REVIEW' }),
      post({ postId: 'review-dirty', stage: 'IN_REVIEW' }),
      post({ postId: 'failed', stage: 'FAILED' }),
      post({ postId: 'rendering', stage: 'RENDERING' }),
    ];
    expect(sortWork(list, new Set(['review-dirty'])).map((p) => p.postId)).toEqual([
      'failed',
      'rendering',
      'review-dirty',
      'review-clean',
      'approved',
    ]);
  });
});

import { isAscending, syncBlockReason } from '../src/shared/sync-guard';

describe('chặn gửi bản sửa', () => {
  const r = (status: string): RemoteDesign => ({
    assetId: status, figmaNodeId: null, fingerprint: null, version: 1, orderIndex: 0, assetUrl: null, status,
  });

  it('còn slide chờ dựng thì chặn, nói rõ số slide', () => {
    expect(syncBlockReason([r('IN_REVIEW'), r('PENDING_RENDER'), r('RENDERING')])).toMatch(/còn 2 slide đang chờ dựng/);
  });

  it('có slide lỗi thì bảo thử lại trước', () => {
    expect(syncBlockReason([r('IN_REVIEW'), r('FAILED')])).toMatch(/Thử lại/);
  });

  it('dựng xong hết thì cho gửi', () => {
    expect(syncBlockReason([r('IN_REVIEW'), r('APPROVED')])).toBeNull();
  });

  it('thứ tự tăng dần (cho phép vắng slide chưa dựng)', () => {
    expect(isAscending([0, 1, 3])).toBe(true);
    expect(isAscending([1, 0])).toBe(false);
    expect(isAscending([])).toBe(true);
  });
});
