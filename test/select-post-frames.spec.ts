import { selectPostFrames, FrameInfo } from '../src/services/select-post-frames';

const bound = (id: string, postId: string, assetId = `a-${id}`): FrameInfo<string> => ({
  id,
  node: id,
  metadata: { postId, assetId, version: 1 },
});
const unbound = (id: string): FrameInfo<string> => ({ id, node: id, metadata: null });

describe('selectPostFrames', () => {
  it('metadata postId khớp → nhận; khác → bỏ', () => {
    const r = selectPostFrames([bound('1', 'P'), bound('2', 'Q'), bound('3', 'P')], 'P', []);
    expect(r.frames.map((f) => f.id)).toEqual(['1', '3']);
    expect(r.skippedUnbound).toBe(0);
  });

  it('không metadata, không được chọn → bỏ, đếm vào skippedUnbound', () => {
    const r = selectPostFrames([bound('1', 'P'), unbound('9'), unbound('8')], 'P', []);
    expect(r.frames.map((f) => f.id)).toEqual(['1']);
    expect(r.skippedUnbound).toBe(2);
  });

  it('không metadata, được chọn → nhận', () => {
    const r = selectPostFrames([bound('1', 'P'), unbound('9')], 'P', ['9']);
    expect(r.frames.map((f) => f.id)).toEqual(['1', '9']);
    expect(r.skippedUnbound).toBe(0);
  });

  it('metadata thiếu postId (rỗng) coi như chưa gắn bài', () => {
    const half: FrameInfo<string> = { id: '5', node: '5', metadata: { postId: '', assetId: 'a5' } };
    expect(selectPostFrames([half], 'P', []).skippedUnbound).toBe(1);
    expect(selectPostFrames([half], 'P', ['5']).frames.map((f) => f.id)).toEqual(['5']);
  });

  it('không có postId → không nhận frame không metadata (kể cả đang chọn); tự nhận postId từ frame đầu có metadata', () => {
    const r = selectPostFrames([unbound('9'), bound('1', 'P'), bound('2', 'Q')], '', ['9']);
    expect(r.postId).toBe('P');
    expect(r.frames.map((f) => f.id)).toEqual(['1']);
    expect(r.skippedUnbound).toBe(1);
  });

  it('không có postId và không frame nào có metadata → rỗng, postId rỗng', () => {
    const r = selectPostFrames([unbound('9')], '', ['9']);
    expect(r.postId).toBe('');
    expect(r.frames).toEqual([]);
  });

  it('orderIndex liên tục 0..n-1 trên danh sách ĐÃ LỌC, theo thứ tự canvas', () => {
    const r = selectPostFrames(
      [unbound('x'), bound('1', 'P'), bound('q', 'Q'), unbound('9'), bound('2', 'P')],
      'P',
      ['9'],
    );
    expect(r.frames.map((f) => [f.id, f.orderIndex])).toEqual([
      ['1', 0],
      ['9', 1],
      ['2', 2],
    ]);
  });

  it('trả kèm metadata để Scan đọc assetId/version', () => {
    const r = selectPostFrames([bound('1', 'P', 'asset-1')], 'P', []);
    expect(r.frames[0].metadata).toEqual({ postId: 'P', assetId: 'asset-1', version: 1 });
    expect(r.frames[0].node).toBe('1');
  });
});
