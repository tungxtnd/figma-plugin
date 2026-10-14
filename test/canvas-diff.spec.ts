import {
  computeCanvasDiff,
  buildSyncChanges,
  buildMetadataUpdates,
  extractSyncResults,
  adoptRemoteVersions,
  ScannedSlide,
  RemoteDesign,
} from '../src/services/canvas-diff';
import { DiffResult } from '../src/types';

// Hash giả: đủ để so "giống/khác" mà không phụ thuộc MD5.
const hash = (s: string) => `h(${s})`;

function slide(over: Partial<ScannedSlide>): ScannedSlide {
  return { figmaNodeId: '1:1', orderIndex: 0, fingerprint: 'raw', ...over };
}

function remote(over: Partial<RemoteDesign>): RemoteDesign {
  return {
    assetId: 'a1',
    figmaNodeId: '1:1',
    fingerprint: 'h(raw)',
    version: 1,
    orderIndex: 0,
    ...over,
  };
}

const byNode = (diffs: DiffResult[], id: string) =>
  diffs.find((d) => d.figmaNodeId === id)!;

describe('computeCanvasDiff', () => {
  it('frame không metadata → CREATE, không mang assetId', () => {
    const [d] = computeCanvasDiff([slide({ figmaNodeId: '9:9' })], [], hash);
    expect(d).toMatchObject({ action: 'CREATE', assetId: undefined, version: 1, fingerprint: 'h(raw)' });
  });

  it('fingerprint khác → UPDATE; giống → UNCHANGED', () => {
    const diffs = computeCanvasDiff(
      [
        slide({ figmaNodeId: '1:1', pluginAssetId: 'a1', version: 1, fingerprint: 'new', orderIndex: 0 }),
        slide({ figmaNodeId: '1:2', pluginAssetId: 'a2', version: 1, fingerprint: 'same', orderIndex: 1 }),
      ],
      [
        remote({ assetId: 'a1', fingerprint: 'h(old)', orderIndex: 0 }),
        remote({ assetId: 'a2', figmaNodeId: '1:2', fingerprint: 'h(same)', orderIndex: 1 }),
      ],
      hash,
    );
    expect(byNode(diffs, '1:1').action).toBe('UPDATE');
    expect(byNode(diffs, '1:2').action).toBe('UNCHANGED');
  });

  it('asset remote không còn frame → DELETE', () => {
    const diffs = computeCanvasDiff([], [remote({ assetId: 'a5', figmaNodeId: '1:5', version: 3 })], hash);
    expect(diffs).toEqual([
      expect.objectContaining({ action: 'DELETE', assetId: 'a5', figmaNodeId: '1:5', version: 3 }),
    ]);
  });

  it('giống fingerprint nhưng orderIndex khác remote → REORDER', () => {
    const diffs = computeCanvasDiff(
      [slide({ pluginAssetId: 'a1', version: 1, orderIndex: 2 })],
      [remote({ assetId: 'a1', orderIndex: 0 })],
      hash,
    );
    expect(diffs[0]).toMatchObject({ action: 'REORDER', orderIndex: 2, version: 1 });
  });

  it('khác fingerprint VÀ khác vị trí → UPDATE (UPDATE cũng ghi orderIndex)', () => {
    const diffs = computeCanvasDiff(
      [slide({ pluginAssetId: 'a1', version: 1, orderIndex: 2, fingerprint: 'new' })],
      [remote({ assetId: 'a1', orderIndex: 0 })],
      hash,
    );
    expect(diffs[0]).toMatchObject({ action: 'UPDATE', orderIndex: 2 });
  });

  it('local.version (2) > remote.version (1) → dùng 1 + cờ cảnh báo (tự chữa lỗi A)', () => {
    const [d] = computeCanvasDiff(
      [slide({ pluginAssetId: 'a1', version: 2, fingerprint: 'new' })],
      [remote({ assetId: 'a1', version: 1 })],
      hash,
    );
    expect(d.action).toBe('UPDATE');
    expect(d.version).toBe(1);
    expect(d.warning).toMatch(/version/i);
  });

  it('local.version (1) < remote.version (2) → giữ 1 để server 409', () => {
    const [d] = computeCanvasDiff(
      [slide({ pluginAssetId: 'a1', version: 1, fingerprint: 'new' })],
      [remote({ assetId: 'a1', version: 2 })],
      hash,
    );
    expect(d.version).toBe(1);
    expect(d.warning).toBeUndefined();
  });

  it('frame có metadata nhưng thiếu version → lấy version remote', () => {
    const [d] = computeCanvasDiff(
      [slide({ pluginAssetId: 'a1', fingerprint: 'new' })],
      [remote({ assetId: 'a1', version: 4 })],
      hash,
    );
    expect(d.version).toBe(4);
  });

  it('hai frame cùng assetId (duplicate Ctrl+D): frame đầu giữ asset, frame sau CREATE, không mang assetId/version cũ', () => {
    const diffs = computeCanvasDiff(
      [
        slide({ figmaNodeId: '1:4', pluginAssetId: 'a4', version: 3, orderIndex: 0 }),
        slide({ figmaNodeId: '7:7', pluginAssetId: 'a4', version: 3, orderIndex: 1, fingerprint: 'edited' }),
      ],
      [remote({ assetId: 'a4', figmaNodeId: '1:4', version: 3 })],
      hash,
    );
    expect(byNode(diffs, '1:4')).toMatchObject({ action: 'UNCHANGED', assetId: 'a4', version: 3 });
    expect(byNode(diffs, '7:7')).toMatchObject({ action: 'CREATE', assetId: undefined, version: 1 });
    expect(diffs.some((d) => d.action === 'DELETE')).toBe(false);
  });

  it('metadata cũ (version 1) nhưng nội dung đã khớp server (v2) → UNCHANGED, version server, cờ healMetadata', () => {
    const [d] = computeCanvasDiff(
      [slide({ pluginAssetId: 'a1', version: 1, fingerprint: 'raw' })],
      [remote({ assetId: 'a1', version: 2, fingerprint: 'h(raw)' })],
      hash,
    );
    expect(d).toMatchObject({ action: 'UNCHANGED', version: 2, healMetadata: true });
  });

  it('metadata đúng version → không cờ healMetadata', () => {
    const [d] = computeCanvasDiff(
      [slide({ pluginAssetId: 'a1', version: 2 })],
      [remote({ assetId: 'a1', version: 2 })],
      hash,
    );
    expect(d.healMetadata).toBeUndefined();
  });

  it('giữ tên frame và vị trí cũ (fromIndex) để hiển thị', () => {
    const diffs = computeCanvasDiff(
      [slide({ figmaNodeId: '1:5', name: 'Slide_5', pluginAssetId: 'a5', version: 1, orderIndex: 2 })],
      [
        remote({ assetId: 'a5', figmaNodeId: '1:5', orderIndex: 4 }),
        remote({ assetId: 'a3', figmaNodeId: '1:3', orderIndex: 2 }),
      ],
      hash,
    );
    expect(byNode(diffs, '1:5')).toMatchObject({ action: 'REORDER', name: 'Slide_5', fromIndex: 4 });
    expect(byNode(diffs, '1:3')).toMatchObject({ action: 'DELETE', fromIndex: 2 });
  });

  it('frame mang assetId không còn trên server → CREATE mới', () => {
    const [d] = computeCanvasDiff([slide({ pluginAssetId: 'gone', version: 2 })], [], hash);
    expect(d).toMatchObject({ action: 'CREATE', assetId: undefined, version: 1 });
  });
});

describe('buildSyncChanges', () => {
  const diffs: DiffResult[] = [
    { figmaNodeId: '1:1', assetId: 'a1', version: 1, orderIndex: 0, fingerprint: 'f', action: 'UNCHANGED' },
    { figmaNodeId: '1:2', assetId: 'a2', version: 1, orderIndex: 1, fingerprint: 'f', action: 'UPDATE', warning: 'x' },
    { figmaNodeId: '9:9', version: 1, orderIndex: 2, fingerprint: 'f', action: 'CREATE' },
    { figmaNodeId: '1:3', assetId: 'a3', version: 1, orderIndex: 3, fingerprint: 'f', action: 'REORDER' },
    { figmaNodeId: '1:5', assetId: 'a5', version: 1, orderIndex: -1, fingerprint: 'f', action: 'DELETE' },
  ];

  it('bỏ UNCHANGED; fileFieldName CHỈ cho CREATE/UPDATE; không gửi trường nội bộ (warning)', () => {
    const changes = buildSyncChanges(diffs);
    expect(changes.map((c) => c.action)).toEqual(['UPDATE', 'CREATE', 'REORDER', 'DELETE']);
    expect(changes.find((c) => c.action === 'UPDATE')!.fileFieldName).toBe('slide_1:2');
    expect(changes.find((c) => c.action === 'CREATE')!.fileFieldName).toBe('slide_9:9');
    expect(changes.find((c) => c.action === 'REORDER')!.fileFieldName).toBeUndefined();
    expect(changes.find((c) => c.action === 'DELETE')!.fileFieldName).toBeUndefined();
    expect(changes.every((c) => !('warning' in c))).toBe(true);
  });
});

describe('adoptRemoteVersions (sau 409)', () => {
  it('UPDATE có version cũ hơn server → nhận version server, trả danh sách đã nhận', () => {
    const diffs: DiffResult[] = [
      { figmaNodeId: '1:7', assetId: 'a7', version: 1, orderIndex: 4, fingerprint: 'f7', action: 'UPDATE' },
      { figmaNodeId: '1:1', assetId: 'a1', version: 2, orderIndex: 0, fingerprint: 'f1', action: 'UPDATE' },
      { figmaNodeId: '9:9', version: 1, orderIndex: 5, fingerprint: 'f9', action: 'CREATE' },
    ];
    const { diffs: next, adopted } = adoptRemoteVersions(diffs, [
      remote({ assetId: 'a7', version: 2 }),
      remote({ assetId: 'a1', version: 2 }),
    ]);
    expect(next.map((d) => d.version)).toEqual([2, 2, 1]);
    expect(adopted).toEqual([expect.objectContaining({ figmaNodeId: '1:7', version: 2, fromVersion: 1 })]);
    // không đổi mảng gốc
    expect(diffs[0].version).toBe(1);
  });

  it('asset không còn trên server → giữ nguyên', () => {
    const diffs: DiffResult[] = [
      { figmaNodeId: '1:7', assetId: 'gone', version: 1, orderIndex: 0, fingerprint: 'f', action: 'UPDATE' },
    ];
    expect(adoptRemoteVersions(diffs, []).adopted).toEqual([]);
  });
});

describe('extractSyncResults', () => {
  const results = [{ assetId: 'a', figmaNodeId: '1:1', action: 'UPDATE', newVersion: 2 }];

  it('đọc results trong envelope { data: { results } } (backend bọc buildWorkflowEnvelope)', () => {
    expect(extractSyncResults({ status: 'success', data: { results } })).toEqual(results);
  });

  it('vẫn đọc được dạng phẳng { results }', () => {
    expect(extractSyncResults({ results })).toEqual(results);
  });

  it('không có gì → mảng rỗng', () => {
    expect(extractSyncResults(undefined)).toEqual([]);
    expect(extractSyncResults({ data: {} })).toEqual([]);
  });
});

describe('buildMetadataUpdates', () => {
  it('version lấy từ newVersion của server (không tự cộng); REORDER giữ version server trả', () => {
    const diffs: DiffResult[] = [
      { figmaNodeId: '9:9', version: 1, orderIndex: 4, fingerprint: 'fc', action: 'CREATE' },
      { figmaNodeId: '1:2', assetId: 'a2', version: 1, orderIndex: 1, fingerprint: 'fu', action: 'UPDATE' },
      { figmaNodeId: '1:3', assetId: 'a3', version: 2, orderIndex: 2, fingerprint: 'fr', action: 'REORDER' },
      { figmaNodeId: '1:5', assetId: 'a5', version: 1, orderIndex: -1, fingerprint: '', action: 'DELETE' },
      { figmaNodeId: '1:1', assetId: 'a1', version: 1, orderIndex: 0, fingerprint: 'f1', action: 'UNCHANGED' },
    ];
    const results = [
      { assetId: 'new-1', figmaNodeId: '9:9', action: 'CREATE', newVersion: 1 },
      { assetId: 'a2', figmaNodeId: '1:2', action: 'UPDATE', newVersion: 2 },
      { assetId: 'a3', figmaNodeId: '1:3', action: 'REORDER', newVersion: 2 },
      { assetId: 'a5', figmaNodeId: '1:5', action: 'DELETE', newVersion: 0 },
    ];
    const { updates, missing } = buildMetadataUpdates(diffs, results, 'post-1');
    expect(missing).toEqual([]);
    expect(updates).toEqual([
      { figmaNodeId: '9:9', postId: 'post-1', assetId: 'new-1', version: 1, fingerprint: 'fc' },
      { figmaNodeId: '1:2', postId: 'post-1', assetId: 'a2', version: 2, fingerprint: 'fu' },
      { figmaNodeId: '1:3', postId: 'post-1', assetId: 'a3', version: 2, fingerprint: 'fr' },
    ]);
  });

  it('thiếu kết quả server cho một frame → bỏ qua frame đó, báo trong missing', () => {
    const diffs: DiffResult[] = [
      { figmaNodeId: '9:9', version: 1, orderIndex: 0, fingerprint: 'f', action: 'CREATE' },
    ];
    const { updates, missing } = buildMetadataUpdates(diffs, [], 'post-1');
    expect(updates).toEqual([]);
    expect(missing).toEqual(['9:9']);
  });

  it('không lấy nhầm kết quả DELETE trùng figmaNodeId', () => {
    const diffs: DiffResult[] = [
      { figmaNodeId: '1:5', version: 1, orderIndex: 0, fingerprint: 'f', action: 'CREATE' },
    ];
    const { updates, missing } = buildMetadataUpdates(
      diffs,
      [{ assetId: 'old', figmaNodeId: '1:5', action: 'DELETE', newVersion: 0 }],
      'post-1',
    );
    expect(updates).toEqual([]);
    expect(missing).toEqual(['1:5']);
  });
});
