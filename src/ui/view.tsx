import * as React from 'react';
import { WorkPost } from '../shared/api-types';
import { SectionState } from '../shared/messages';
import { CardAction, cardActions, describePost, stageMeta, Tone } from '../shared/work';
import type { LogEntry, RunningJob } from './hooks';
import type { SyncState } from './sync-flow';

/*
 * Lớp hiển thị: chỉ nhận props, không gọi API hay sandbox. Trang xem thử
 * (dev/preview) dựng thẳng các component này với dữ liệu mẫu.
 */

// ── Phần tử nhỏ ─────────────────────────────────────────────────────────────

export function Dot({ tone }: { tone: Tone }) {
  return <span className={`dot tone-${tone}`} aria-hidden="true" />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  block,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; block?: boolean }) {
  const cls = ['btn', variant !== 'secondary' && `btn-${variant}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest} />;
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Đóng">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Header và thanh tự dựng ─────────────────────────────────────────────────

export function Header({ userName, onSettings }: { userName?: string; onSettings?: () => void }) {
  return (
    <div className="header">
      <span className="corner" aria-hidden="true" />
      <span className="header-title">Capi · Thiết kế</span>
      {userName && <span className="header-user" title={userName}>{userName}</span>}
      {onSettings && (
        <Button variant="ghost" onClick={onSettings} style={userName ? undefined : { marginLeft: 'auto' }}>
          Cài đặt
        </Button>
      )}
    </div>
  );
}

export function AutoRenderBar({
  enabled,
  running,
  onToggle,
}: {
  enabled: boolean;
  running: RunningJob | null;
  onToggle: (next: boolean) => void;
}) {
  let status: string;
  if (running) status = `Đang dựng “${running.title}” · slide ${running.orderIndex + 1}/${running.slideCount}`;
  else if (enabled) status = 'Đang chờ việc mới.';
  else status = 'Đã tạm dừng, bật lại để dựng tiếp.';

  return (
    <div className="autobar">
      <div className="autobar-row">
        <span className="autobar-title">Tự dựng slide</span>
        <label className="toggle">
          <span>{enabled ? 'Bật' : 'Tắt'}</span>
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} aria-label="Tự dựng slide" />
          <span className="toggle-track" />
        </label>
      </div>
      <div className="autobar-status" aria-live="polite">{status}</div>
      <div className="autobar-hint">Giữ plugin mở để slide tự dựng. Slide nằm ở trang “Capi · Slide”.</div>
    </div>
  );
}

// ── Thẻ bài ─────────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<CardAction, string> = {
  view: 'Xem trên canvas',
  sync: 'Gửi bản sửa',
  retry: 'Thử lại',
  web: 'Mở trên web',
  log: 'Xem nhật ký',
};

export function PostCard({
  post,
  section,
  running,
  selected,
  busy,
  onAction,
}: {
  post: WorkPost;
  section?: SectionState;
  running?: RunningJob | null;
  selected?: boolean;
  busy?: boolean;
  onAction: (action: CardAction, post: WorkPost) => void;
}) {
  const isRunning = running?.postId === post.postId;
  const meta = stageMeta(post.stage);
  const dirty = !!section?.dirty;
  const actions = cardActions(post, { hasSection: !!section, dirty });
  // Một nút chính: việc người dùng nên bấm trước.
  const primary: CardAction | undefined = actions.includes('sync') ? 'sync' : actions.includes('retry') ? 'retry' : undefined;
  const { total, rendered } = post.slides;
  const showProgress = (post.stage === 'RENDERING' || isRunning) && total > 0;

  return (
    <article className={['card', isRunning && 'is-running', selected && 'is-selected'].filter(Boolean).join(' ')}>
      <div className="card-title">{post.title}</div>
      <div className="card-status">
        <Dot tone={meta.tone} />
        <span>{isRunning ? `Đang dựng slide ${running!.orderIndex + 1}` : meta.label}</span>
        {total > 0 && <span className="card-count">{rendered}/{total}</span>}
      </div>
      <div className="card-desc">{describePost(post)}</div>
      {showProgress && (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={rendered}>
          <span style={{ width: `${Math.round((rendered / total) * 100)}%` }} />
        </div>
      )}
      {dirty && <div className="card-note">Có chỗ sửa trên canvas chưa gửi.</div>}
      {actions.length > 0 && (
        <div className="card-actions">
          {primary && (
            <Button variant="primary" disabled={busy} onClick={() => onAction(primary, post)}>
              {ACTION_LABEL[primary]}
            </Button>
          )}
          {actions
            .filter((a) => a !== primary)
            .map((a) => (
              <Button key={a} variant={a === 'log' ? 'ghost' : 'secondary'} disabled={busy} onClick={() => onAction(a, post)}>
                {ACTION_LABEL[a]}
              </Button>
            ))}
        </div>
      )}
    </article>
  );
}

/** Section đang chọn thuộc bài không giao cho mình (file được mời vào sửa hộ). */
export function SelectedSectionCard({
  section,
  onView,
  onSync,
}: {
  section: SectionState;
  onView: () => void;
  onSync: () => void;
}) {
  return (
    <article className="card is-selected">
      <div className="list-heading">Đang chọn trên canvas</div>
      <div className="card-title" style={{ marginTop: 2 }}>{section.name}</div>
      <div className="card-desc">Bài này không giao cho bạn dựng, nhưng bạn vẫn gửi bản sửa được.</div>
      {section.dirty && <div className="card-note">Có chỗ sửa trên canvas chưa gửi.</div>}
      <div className="card-actions">
        {section.dirty && (
          <Button variant="primary" onClick={onSync}>
            Gửi bản sửa
          </Button>
        )}
        <Button onClick={onView}>Xem trên canvas</Button>
      </div>
    </article>
  );
}

export function EmptyState() {
  return (
    <div className="empty">
      <strong>Bạn chưa có bài nào cần dựng.</strong>
      Bài bạn duyệt nháp trên web sẽ tự hiện ở đây.
    </div>
  );
}

export function AuthBanner({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="banner" role="alert">
      Mã kết nối không còn hiệu lực, plugin đã dừng nhận việc. Bạn lấy mã mới trên web rồi nhập lại nhé.
      <div>
        <Button variant="danger" onClick={onReconnect}>
          Nhập mã mới
        </Button>
      </div>
    </div>
  );
}

// ── Nhật ký ─────────────────────────────────────────────────────────────────

export function ActivityLog({
  entries,
  open,
  onToggle,
}: {
  entries: LogEntry[];
  open: boolean;
  onToggle: () => void;
}) {
  const problems = entries.filter((e) => e.level === 'error').length;
  return (
    <div className="log">
      <button type="button" className="log-toggle" aria-expanded={open} onClick={onToggle}>
        <ChevronIcon />
        Nhật ký chi tiết
        {problems > 0 && <span className="muted">· {problems} lỗi</span>}
      </button>
      {open && (
        <div className="log-body">
          {entries.length === 0 && <div className="muted">Chưa có hoạt động nào.</div>}
          {entries.map((e) => (
            <div key={e.id} className={`log-row level-${e.level}`}>
              <span className="log-time">{e.time}</span>
              <span>
                <span className="log-msg">{e.message}</span>
                {e.detail && <div className="log-detail">{e.detail}</div>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Màn kết nối ─────────────────────────────────────────────────────────────

export function ConnectScreen({
  servers,
  initialServer,
  webAppUrl,
  busy,
  error,
  onOpenWeb,
  onConnect,
}: {
  servers: readonly { id: string; label: string; url: string }[];
  initialServer: string;
  webAppUrl: string | null;
  busy: boolean;
  error: string | null;
  onOpenWeb: () => void;
  onConnect: (serverUrl: string, token: string) => void;
}) {
  const [token, setToken] = React.useState('');
  const known = servers.some((s) => s.url === initialServer);
  const [choice, setChoice] = React.useState(known ? initialServer : initialServer ? 'custom' : servers[0].url);
  const [custom, setCustom] = React.useState(known ? '' : initialServer);
  const serverUrl = choice === 'custom' ? custom.trim() : choice;

  return (
    <div className="connect">
      <h1>Kết nối với Capi</h1>
      <p className="lead">Plugin cần mã kết nối của riêng bạn để nhận đúng những bài giao cho bạn dựng.</p>

      <div className="step">
        <span className="step-num">1</span>
        <div>
          <div className="step-title">Lấy mã kết nối trên web</div>
          <div className="step-text">
            Trên Capi Marketing Workspace, bấm vào tên bạn ở góc phải, chọn “Kết nối Figma plugin”, rồi tạo và copy mã.
          </div>
          {webAppUrl && <Button onClick={onOpenWeb}>Mở trang lấy mã</Button>}
        </div>
      </div>

      <form
        className="step"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim() && serverUrl) onConnect(serverUrl, token.trim());
        }}
      >
        <span className="step-num">2</span>
        <div>
          <div className="step-title">Dán mã vào đây</div>
          <label className="sr-only" htmlFor="token">Mã kết nối</label>
          <input
            id="token"
            className="field"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Mã kết nối"
            autoComplete="off"
            spellCheck={false}
          />
          {error && <div className="field-error" role="alert">{error}</div>}

          <details className="advanced" open={!known && !!initialServer}>
            <summary>Nâng cao: máy chủ</summary>
            {servers.map((s) => (
              <label key={s.id} className="radio">
                <input type="radio" name="server" checked={choice === s.url} onChange={() => setChoice(s.url)} />
                {s.label}
              </label>
            ))}
            <label className="radio">
              <input type="radio" name="server" checked={choice === 'custom'} onChange={() => setChoice('custom')} />
              Địa chỉ khác
            </label>
            {choice === 'custom' && (
              <input
                className="field"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="https://…/api"
                aria-label="Địa chỉ máy chủ"
              />
            )}
          </details>

          <div style={{ marginTop: 12 }}>
            <Button variant="primary" block type="submit" disabled={busy || !token.trim() || !serverUrl}>
              {busy ? 'Đang kết nối…' : 'Kết nối'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Sheet cài đặt ───────────────────────────────────────────────────────────

export function SettingsSheet({
  me,
  serverLabel,
  onClose,
  onReconnect,
  onOpenWeb,
  onDisconnect,
}: {
  me: { name: string; email: string } | null;
  serverLabel: string;
  onClose: () => void;
  onReconnect: () => void;
  onOpenWeb?: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Sheet title="Cài đặt" onClose={onClose}>
      <div className="sheet-label">Tài khoản</div>
      <p>
        {me ? `${me.name} · ${me.email}` : 'Chưa kết nối'}
        <br />
        <span className="muted">Máy chủ: {serverLabel}</span>
      </p>
      <div className="sheet-actions">
        <Button onClick={onReconnect}>Đổi mã kết nối</Button>
        {onOpenWeb && <Button onClick={onOpenWeb}>Mở trang lấy mã</Button>}
      </div>
      <div className="sheet-section">
        <div className="sheet-label">Plugin làm gì</div>
        <p>
          Khi bật “Tự dựng slide”, plugin nhận lần lượt từng slide của những bài giao cho bạn và dựng vào trang “Capi ·
          Slide”, mỗi bài một Section. Bài đã đăng sẽ tự được dọn khỏi canvas.
        </p>
      </div>
      <div className="sheet-section">
        <Button variant="danger" onClick={onDisconnect}>
          Đăng xuất khỏi plugin
        </Button>
      </div>
    </Sheet>
  );
}

// ── Sheet gửi bản sửa ───────────────────────────────────────────────────────

export function SyncSheet({
  title,
  state,
  onClose,
  onConfirm,
  onRecheck,
}: {
  title: string;
  state: SyncState;
  onClose: () => void;
  onConfirm: () => void;
  onRecheck: () => void;
}) {
  const [ack, setAck] = React.useState(false);
  const deletes = state.phase === 'review' ? state.diff.counts.DELETE : 0;

  return (
    <Sheet title={`Gửi bản sửa · ${title}`} onClose={onClose}>
      {state.phase === 'checking' && <p>Đang so canvas với hệ thống…</p>}
      {state.phase === 'sending' && <p>Đang gửi bản sửa…</p>}
      {(state.phase === 'blocked' || state.phase === 'nothing' || state.phase === 'done') && <p>{state.message}</p>}
      {state.phase === 'error' && (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {state.message}
        </p>
      )}

      {state.phase === 'review' && (
        <>
          <p>{state.summary}</p>
          {state.thumbs.length > 0 && (
            <div className="thumbs">
              {state.thumbs.map((t) => (
                <div key={t.nodeId} className="thumb">
                  <img src={t.url} alt="" />
                  {t.label}
                </div>
              ))}
            </div>
          )}
          {deletes > 0 && (
            <div className="warn-box">
              Sẽ xoá {deletes} slide trên hệ thống vì chúng không còn trong Section.
              <label>
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                Tôi muốn xoá {deletes} slide này.
              </label>
            </div>
          )}
        </>
      )}

      <div className="sheet-actions">
        {state.phase === 'review' ? (
          <>
            <Button onClick={onClose}>Để sau</Button>
            <Button variant="primary" disabled={deletes > 0 && !ack} onClick={onConfirm}>
              Gửi bản sửa
            </Button>
          </>
        ) : state.phase === 'error' ? (
          <>
            <Button onClick={onClose}>Đóng</Button>
            <Button variant="primary" onClick={onRecheck}>
              Kiểm tra lại
            </Button>
          </>
        ) : (
          <Button onClick={onClose} disabled={state.phase === 'sending'}>
            {state.phase === 'done' || state.phase === 'nothing' ? 'Xong' : 'Đóng'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
