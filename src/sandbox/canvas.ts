import SparkMD5 from 'spark-md5';
import { serializeNode } from '../utils';
import { SectionState } from '../shared/messages';
import {
  Box,
  nextSectionOrigin,
  orderByPosition,
  sectionName,
  sectionSizeFor,
} from '../shared/layout';
import { isAscending } from '../shared/sync-guard';

/**
 * Mọi slide nằm trên MỘT trang riêng của file, mỗi bài một Section. Plugin vẽ
 * vào trang đó kể cả khi người dùng đang mở trang khác — không giật màn hình,
 * không đè lên thứ người dùng đang làm.
 */
export const WORK_PAGE_NAME = 'Capi · Slide';

/** Giữ tên khoá cũ: frame dựng trước đợt này vẫn đọc được metadata. */
export const FRAME_META_KEY = 'figma_reconciliation_metadata';
const SECTION_POST_KEY = 'capi_post_id';
const SECTION_ASSETS_KEY = 'capi_assets';
const WORK_PAGE_KEY = 'capi_work_page';

export interface FrameMeta {
  postId: string;
  assetId: string;
  version: number;
  fingerprint: string;
  orderIndex: number;
}

export async function getWorkPage(): Promise<PageNode> {
  let page =
    figma.root.children.find((p) => p.getPluginData(WORK_PAGE_KEY) === '1') ??
    figma.root.children.find((p) => p.name === WORK_PAGE_NAME);
  if (!page) {
    page = figma.createPage();
    page.name = WORK_PAGE_NAME;
  }
  page.setPluginData(WORK_PAGE_KEY, '1');
  await page.loadAsync();
  return page;
}

export function readFrameMeta(node: BaseNode): FrameMeta | null {
  const raw = node.getPluginData(FRAME_META_KEY);
  if (!raw) return null;
  try {
    const meta = JSON.parse(raw);
    return meta && meta.assetId ? (meta as FrameMeta) : null;
  } catch (_) {
    return null;
  }
}

export function writeFrameMeta(node: BaseNode, meta: FrameMeta): void {
  node.setPluginData(FRAME_META_KEY, JSON.stringify(meta));
}

export function sectionPostId(node: BaseNode): string {
  return node.getPluginData(SECTION_POST_KEY);
}

export function postSections(page: PageNode): SectionNode[] {
  return page.children.filter(
    (n): n is SectionNode => n.type === 'SECTION' && !!n.getPluginData(SECTION_POST_KEY),
  );
}

export function findSection(page: PageNode, postId: string): SectionNode | null {
  return postSections(page).find((s) => s.getPluginData(SECTION_POST_KEY) === postId) ?? null;
}

/** Section đang chứa node (node chính là Section, hoặc nằm bên trong). */
export function sectionOf(node: BaseNode | null): SectionNode | null {
  let current: BaseNode | null = node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if (current.type === 'SECTION' && current.getPluginData(SECTION_POST_KEY)) {
      return current as SectionNode;
    }
    current = current.parent;
  }
  return null;
}

export function ensureSection(page: PageNode, postId: string, title: string, slideSize: number): SectionNode {
  const name = sectionName(title, postId);
  const existing = findSection(page, postId);
  if (existing) {
    if (existing.name !== name) existing.name = name;
    return existing;
  }

  const others: Box[] = page.children
    .filter((n) => 'width' in n)
    .map((n) => ({ x: n.x, y: n.y, width: (n as any).width, height: (n as any).height }));
  const origin = nextSectionOrigin(others);
  const size = sectionSizeFor([], slideSize);

  const section = figma.createSection();
  page.appendChild(section);
  section.name = name;
  section.x = origin.x;
  section.y = origin.y;
  section.resizeWithoutConstraints(size.width, size.height);
  section.setPluginData(SECTION_POST_KEY, postId);
  // Chọn Section là thấy nút mở plugin ngay ở panel bên phải.
  section.setRelaunchData({ open: 'Xem việc dựng slide của bài này' });
  return section;
}

/** Slide của bài = frame nằm trực tiếp trong Section. */
export function slideFrames(section: SectionNode): FrameNode[] {
  return section.children.filter((n): n is FrameNode => n.type === 'FRAME');
}

export function findFrameByAsset(section: SectionNode, assetId: string): FrameNode | null {
  return slideFrames(section).find((f) => readFrameMeta(f)?.assetId === assetId) ?? null;
}

export function fitSection(section: SectionNode, slideSize: number): void {
  const kids: Box[] = section.children
    .filter((n) => 'width' in n)
    .map((n) => ({ x: n.x, y: n.y, width: (n as any).width, height: (n as any).height }));
  const size = sectionSizeFor(kids, slideSize);
  section.resizeWithoutConstraints(Math.max(size.width, section.width), Math.max(size.height, section.height));
}

export function fingerprintOf(frame: SceneNode): string {
  return SparkMD5.hash(serializeNode(frame));
}

export function knownAssets(section: SectionNode): string[] {
  try {
    const list = JSON.parse(section.getPluginData(SECTION_ASSETS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

export function setKnownAssets(section: SectionNode, assetIds: string[]): void {
  section.setPluginData(SECTION_ASSETS_KEY, JSON.stringify([...new Set(assetIds)]));
}

/**
 * Có sửa trên canvas mà chưa gửi không — so với metadata ghi lúc dựng/gửi gần
 * nhất, nên mở lại plugin vẫn biết, không cần nhớ sự kiện.
 */
export function sectionState(section: SectionNode): SectionState {
  const postId = sectionPostId(section);
  const frames = orderByPosition(slideFrames(section));
  const present = new Set<string>();
  const order: number[] = [];
  let dirty = false;

  for (const frame of frames) {
    const meta = readFrameMeta(frame);
    if (!meta) {
      dirty = true; // slide mới người dùng tự thêm
      continue;
    }
    if (meta.postId !== postId) continue; // frame của bài khác kéo nhầm vào
    present.add(meta.assetId);
    order.push(meta.orderIndex);
    if (meta.fingerprint !== fingerprintOf(frame)) dirty = true;
  }
  if (!isAscending(order)) dirty = true;
  if (knownAssets(section).some((id) => !present.has(id))) dirty = true;

  return { postId, name: section.name, slideCount: frames.length, dirty };
}
