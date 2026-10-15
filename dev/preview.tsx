/**
 * Xem thử giao diện plugin ngoài Figma: `npm run preview` rồi mở
 * dist-preview/preview.html. Dựng thẳng các component hiển thị với dữ liệu mẫu,
 * không gọi máy chủ hay sandbox. Thêm `?theme=dark` để xem nền tối.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { WorkPost } from '../src/shared/api-types';
import { SectionState } from '../src/shared/messages';
import { computeDiff } from '../src/shared/diff';
import { SERVERS } from '../src/ui/backend';
import type { LogEntry } from '../src/ui/hooks';
import {
  ActivityLog,
  AuthBanner,
  AutoRenderBar,
  ConnectScreen,
  EmptyState,
  Header,
  PostCard,
  SelectedSectionCard,
  SettingsSheet,
  SyncSheet,
} from '../src/ui/view';

const DARK: Record<string, string> = {
  '--figma-color-bg': '#2c2c2c',
  '--figma-color-bg-secondary': '#383838',
  '--figma-color-bg-hover': '#3d3d3d',
  '--figma-color-text': '#ffffff',
  '--figma-color-text-secondary': '#b3b3b3',
  '--figma-color-text-tertiary': '#8a8a8a',
  '--figma-color-border': '#444444',
  '--figma-color-bg-brand': '#0c8ce9',
  '--figma-color-text-onbrand': '#ffffff',
  '--figma-color-text-danger': '#f27b5e',
  '--figma-color-bg-danger-tertiary': '#4d2a22',
  '--figma-color-text-warning': '#f3c11b',
  '--figma-color-text-success': '#79d297',
  '--figma-color-text-brand': '#7cc4f8',
};

if (new URLSearchParams(location.search).get('theme') === 'dark') {
  for (const [k, v] of Object.entries(DARK)) document.documentElement.style.setProperty(k, v);
}

const post = (over: Partial<WorkPost>): WorkPost => ({
  postId: Math.random().toString(36).slice(2),
  title: '5 mẹo SEO cho người mới bắt đầu',
  webUrl: 'https://ui.capi.vn/posts/x',
  stage: 'QUEUED',
  slides: { total: 6, rendered: 0, failed: 0 },
  reviewNote: null,
  lastError: null,
  ...over,
});

const posts: WorkPost[] = [
  post({
    postId: 'failed',
    title: 'Khoá học UX tháng 11 — lịch khai giảng và ưu đãi đăng ký sớm',
    stage: 'FAILED',
    slides: { total: 6, rendered: 5, failed: 1 },
    lastError: 'Ảnh nền không tải được',
  }),
  post({ postId: 'running', stage: 'RENDERING', slides: { total: 6, rendered: 3, failed: 0 } }),
  post({ postId: 'dirty', title: 'Case study dự án A', stage: 'IN_REVIEW', slides: { total: 5, rendered: 5, failed: 0 } }),
  post({
    postId: 'queued',
    title: 'Checklist trước khi chạy quảng cáo',
    stage: 'QUEUED',
    reviewNote: 'Đổi ảnh slide 2 sang ảnh lớp học thật',
  }),
  post({ postId: 'approved', title: 'Tuyển sinh khoá Data tháng 12', stage: 'APPROVED', slides: { total: 4, rendered: 4, failed: 0 } }),
];

const sections = new Map<string, SectionState>([
  ['failed', { postId: 'failed', name: 'Khoá học UX', slideCount: 5, dirty: false }],
  ['running', { postId: 'running', name: '5 mẹo SEO', slideCount: 3, dirty: false }],
  ['dirty', { postId: 'dirty', name: 'Case study', slideCount: 5, dirty: true }],
  ['approved', { postId: 'approved', name: 'Tuyển sinh', slideCount: 4, dirty: false }],
]);

const logs: LogEntry[] = [
  { id: 3, time: '10:42', level: 'success', message: 'Đã dựng “5 mẹo SEO cho người mới bắt đầu” slide 3/6.' },
  {
    id: 2,
    time: '10:41',
    level: 'error',
    message: '“Khoá học UX tháng 11” slide 4/6 dựng không được.',
    detail: 'Ảnh nền không tải được',
  },
  { id: 1, time: '10:40', level: 'info', message: 'Đã dọn 2 bài đã đăng khỏi canvas.' },
];

const thumb =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#1A202C"/><rect x="12" y="40" width="60" height="8" fill="#FFB117"/><rect x="12" y="54" width="76" height="5" fill="#ffffff" opacity=".6"/></svg>');

const diff = computeDiff(
  [
    { figmaNodeId: '1', assetId: 'a', version: 1, orderIndex: 0, fingerprint: 'new' },
    { figmaNodeId: '2', assetId: 'b', version: 1, orderIndex: 2, fingerprint: 'b' },
    { figmaNodeId: '3', orderIndex: 3, fingerprint: 'c' },
  ],
  [
    { assetId: 'a', figmaNodeId: '1', fingerprint: 'old', version: 1, orderIndex: 0, assetUrl: '', status: 'IN_REVIEW' },
    { assetId: 'b', figmaNodeId: '2', fingerprint: 'b', version: 1, orderIndex: 1, assetUrl: '', status: 'IN_REVIEW' },
    { assetId: 'z', figmaNodeId: '9', fingerprint: 'z', version: 1, orderIndex: 4, assetUrl: '', status: 'APPROVED' },
  ],
);

const noop = () => {};

function Frame({ label, children, height = 600 }: { label: string; children: React.ReactNode; height?: number }) {
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ font: '12px system-ui', margin: '0 0 6px', color: '#888' }}>{label}</figcaption>
      <div
        data-frame={label}
        style={{ width: 360, height, border: '1px solid #ccc', position: 'relative', overflow: 'hidden', transform: 'translateZ(0)' }}
      >
        <div className="app">{children}</div>
      </div>
    </figure>
  );
}

function Main({ withAuth = false, withForeign = false }: { withAuth?: boolean; withForeign?: boolean }) {
  return (
    <>
      <Header userName="Nguyễn Văn An" onSettings={noop} />
      <AutoRenderBar
        enabled
        running={{ postId: 'running', title: '5 mẹo SEO cho người mới bắt đầu', orderIndex: 3, slideCount: 6 }}
        onToggle={noop}
      />
      <div className="list">
        {withAuth && <AuthBanner onReconnect={noop} />}
        {withForeign && (
          <SelectedSectionCard
            section={{ postId: 'x', name: 'Bài của Bình · 9f3a12cd', slideCount: 4, dirty: true }}
            onView={noop}
            onSync={noop}
          />
        )}
        <div className="list-heading">Việc của bạn ({posts.length})</div>
        {posts.map((p) => (
          <PostCard
            key={p.postId}
            post={p}
            section={sections.get(p.postId)}
            running={{ postId: 'running', title: '', orderIndex: 3, slideCount: 6 }}
            selected={p.postId === 'dirty'}
            onAction={noop}
          />
        ))}
      </div>
      <ActivityLog entries={logs} open={false} onToggle={noop} />
    </>
  );
}

function Gallery() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: 24, background: 'transparent' }}>
      <Frame label="Kết nối">
        <Header />
        <ConnectScreen servers={SERVERS} initialServer={SERVERS[0].url} webAppUrl="https://ui.capi.vn" busy={false} error={null} onOpenWeb={noop} onConnect={noop} />
      </Frame>
      <Frame label="Kết nối — mã sai">
        <Header />
        <ConnectScreen
          servers={SERVERS}
          initialServer={SERVERS[0].url}
          webAppUrl={null}
          busy={false}
          error="Mã không đúng hoặc đã bị thu hồi, bạn lấy mã mới trên web nhé."
          onOpenWeb={noop}
          onConnect={noop}
        />
      </Frame>
      <Frame label="Việc của bạn">
        <Main />
      </Frame>
      <Frame label="Mã hết hiệu lực + Section người khác">
        <Main withAuth withForeign />
      </Frame>
      <Frame label="Trống việc">
        <Header userName="Nguyễn Văn An" onSettings={noop} />
        <AutoRenderBar enabled={false} running={null} onToggle={noop} />
        <div className="list">
          <EmptyState />
        </div>
        <ActivityLog entries={logs} open onToggle={noop} />
      </Frame>
      <Frame label="Gửi bản sửa — có xoá">
        <Main />
        <SyncSheet
          title="Case study dự án A"
          state={{
            phase: 'review',
            diff,
            summary: '1 slide đã sửa · 1 slide đổi thứ tự · 1 slide mới · 1 slide bị xoá',
            thumbs: [
              { nodeId: '1', url: thumb, label: 'Slide 1' },
              { nodeId: '3', url: thumb, label: 'Slide mới 4' },
            ],
          }}
          onClose={noop}
          onConfirm={noop}
          onRecheck={noop}
        />
      </Frame>
      <Frame label="Gửi bản sửa — còn slide chờ dựng">
        <Main />
        <SyncSheet
          title="5 mẹo SEO"
          state={{ phase: 'blocked', message: 'Bài còn 3 slide đang chờ dựng. Đợi dựng xong rồi bạn gửi bản sửa nhé.' }}
          onClose={noop}
          onConfirm={noop}
          onRecheck={noop}
        />
      </Frame>
      <Frame label="Cài đặt">
        <Main />
        <SettingsSheet
          me={{ name: 'Nguyễn Văn An', email: 'an@capi.vn' }}
          serverLabel="Chính thức"
          onClose={noop}
          onReconnect={noop}
          onOpenWeb={noop}
          onDisconnect={noop}
        />
      </Frame>
    </div>
  );
}

createRoot(document.getElementById('react-page')!).render(<Gallery />);
