import * as React from 'react';
import { ApiClient, ApiError } from '../services/api-client';
import { WorkPost } from '../shared/api-types';
import { PluginConfig } from '../shared/messages';
import { CardAction, sortWork } from '../shared/work';
import { Backend, DEFAULT_SERVER, SERVERS, serverLabel } from './backend';
import { onSandbox, toSandbox } from './bridge';
import { useCanvas, useJobRunner, useLog, useWorkList } from './hooks';
import { useSyncFlow } from './sync-flow';
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
} from './view';

function makeBackend(config: PluginConfig): Backend | null {
  if (!config.backendUrl || !config.token) return null;
  return new Backend(new ApiClient({ baseUrl: config.backendUrl, pluginToken: config.token }));
}

export function App() {
  const [config, setConfig] = React.useState<PluginConfig | null>(null);
  const [connecting, setConnecting] = React.useState(false);
  const [connectError, setConnectError] = React.useState<string | null>(null);
  const [forceConnect, setForceConnect] = React.useState(false);
  const [authBroken, setAuthBroken] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [syncTarget, setSyncTarget] = React.useState<{ postId: string; title: string } | null>(null);
  const [busyPost, setBusyPost] = React.useState<string | null>(null);

  const { entries, add: log } = useLog();
  const { sections, selectedPostId } = useCanvas();

  React.useEffect(() => {
    const off = onSandbox((msg) => {
      if (msg.type === 'config') setConfig(msg.config);
    });
    toSandbox({ type: 'init' });
    return off;
  }, []);

  const backend = React.useMemo(
    () => (config ? makeBackend(config) : null),
    [config?.backendUrl, config?.token], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const connected = !!backend && !forceConnect;

  const saveConfig = React.useCallback((next: PluginConfig) => {
    setConfig(next);
    toSandbox({ type: 'save-config', config: next });
  }, []);

  const onAuthError = React.useCallback(
    (err: ApiError) => {
      setAuthBroken(true);
      log('error', 'Mã kết nối không còn hiệu lực.', err.message);
    },
    [log],
  );

  const live = connected && !authBroken ? backend : null;
  const { work, refresh } = useWorkList(live, sections, log, onAuthError);
  const running = useJobRunner(live, !!config?.autoRender, log, refresh, onAuthError);

  const openWeb = React.useCallback(
    (path = '') => {
      const base = config?.webAppUrl;
      if (base) toSandbox({ type: 'open-external', url: `${base.replace(/\/+$/, '')}${path}` });
    },
    [config?.webAppUrl],
  );

  const connect = async (serverUrl: string, token: string) => {
    if (!config) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const probe = makeBackend({ ...config, backendUrl: serverUrl, token })!;
      const mine = await probe.mine();
      saveConfig({ ...config, backendUrl: serverUrl, token, webAppUrl: mine.webAppUrl ?? config.webAppUrl });
      setForceConnect(false);
      setAuthBroken(false);
      log('success', `Đã kết nối với tài khoản ${mine.me.name}.`);
      toSandbox({ type: 'notify', message: `Đã kết nối với tài khoản ${mine.me.name}.` });
    } catch (err) {
      if (err instanceof ApiError && err.isAuth) {
        setConnectError('Mã không đúng hoặc đã bị thu hồi, bạn lấy mã mới trên web nhé.');
      } else if (err instanceof ApiError && (err.code === 'NETWORK_ERROR' || err.status === 408)) {
        setConnectError('Không kết nối được máy chủ. Bạn kiểm tra mạng hoặc địa chỉ máy chủ rồi thử lại.');
      } else {
        setConnectError(`Chưa kết nối được: ${(err as Error).message}`);
      }
    } finally {
      setConnecting(false);
    }
  };

  const onCardAction = async (action: CardAction, post: WorkPost) => {
    switch (action) {
      case 'view':
        toSandbox({ type: 'focus-post', postId: post.postId });
        return;
      case 'sync':
        setSyncTarget({ postId: post.postId, title: post.title });
        return;
      case 'web':
        if (post.webUrl) toSandbox({ type: 'open-external', url: post.webUrl });
        return;
      case 'log':
        setLogOpen(true);
        return;
      case 'retry':
        if (!live) return;
        setBusyPost(post.postId);
        try {
          const n = await live.retryFailed(post.postId);
          log('info', `Đã đưa ${n} slide lỗi của “${post.title}” vào hàng dựng lại.`);
          refresh();
        } catch (err) {
          if (err instanceof ApiError && err.isAuth) onAuthError(err);
          else log('error', `Chưa thử lại được “${post.title}”.`, (err as Error).message);
        } finally {
          setBusyPost(null);
        }
        return;
    }
  };

  if (!config) return <div className="app" />;

  if (!connected) {
    return (
      <div className="app">
        <Header />
        <ConnectScreen
          servers={SERVERS}
          initialServer={config.backendUrl || DEFAULT_SERVER}
          webAppUrl={config.webAppUrl}
          busy={connecting}
          error={connectError}
          onOpenWeb={() => openWeb('/?connect-figma=1')}
          onConnect={connect}
        />
      </div>
    );
  }

  const posts = work ? sortWork(work.posts, new Set([...sections.values()].filter((s) => s.dirty).map((s) => s.postId))) : [];
  const mineIds = new Set(posts.map((p) => p.postId));
  const foreign = selectedPostId && !mineIds.has(selectedPostId) ? sections.get(selectedPostId) : undefined;

  return (
    <div className="app">
      <Header userName={work?.me.name} onSettings={() => setSettingsOpen(true)} />
      <AutoRenderBar
        enabled={config.autoRender}
        running={running}
        onToggle={(next) => saveConfig({ ...config, autoRender: next })}
      />

      <div className="list">
        {authBroken && (
          <AuthBanner
            onReconnect={() => {
              setForceConnect(true);
              setConnectError(null);
            }}
          />
        )}
        {foreign && (
          <SelectedSectionCard
            section={foreign}
            onView={() => toSandbox({ type: 'focus-post', postId: foreign.postId })}
            onSync={() => setSyncTarget({ postId: foreign.postId, title: foreign.name })}
          />
        )}
        {work && posts.length > 0 && <div className="list-heading">Việc của bạn ({posts.length})</div>}
        {work && posts.length === 0 && !foreign && <EmptyState />}
        {!work && !authBroken && <div className="muted">Đang tải danh sách việc…</div>}
        {posts.map((post) => (
          <PostCard
            key={post.postId}
            post={post}
            section={sections.get(post.postId)}
            running={running}
            selected={selectedPostId === post.postId}
            busy={busyPost === post.postId}
            onAction={onCardAction}
          />
        ))}
      </div>

      <ActivityLog entries={entries} open={logOpen} onToggle={() => setLogOpen((o) => !o)} />

      {settingsOpen && (
        <SettingsSheet
          me={work?.me ?? null}
          serverLabel={serverLabel(config.backendUrl)}
          onClose={() => setSettingsOpen(false)}
          onReconnect={() => {
            setSettingsOpen(false);
            setForceConnect(true);
            setConnectError(null);
          }}
          onOpenWeb={config.webAppUrl ? () => openWeb('/?connect-figma=1') : undefined}
          onDisconnect={() => {
            setSettingsOpen(false);
            saveConfig({ ...config, token: '' });
            log('info', 'Đã đăng xuất khỏi plugin.');
          }}
        />
      )}

      {syncTarget && live && (
        <SyncContainer
          key={syncTarget.postId}
          backend={live}
          target={syncTarget}
          log={log}
          onDone={refresh}
          onClose={() => setSyncTarget(null)}
        />
      )}
    </div>
  );
}

function SyncContainer({
  backend,
  target,
  log,
  onDone,
  onClose,
}: {
  backend: Backend;
  target: { postId: string; title: string };
  log: ReturnType<typeof useLog>['add'];
  onDone: () => void;
  onClose: () => void;
}) {
  const { state, confirm, recheck } = useSyncFlow(backend, target.postId, target.title, log, onDone);
  return <SyncSheet title={target.title} state={state} onClose={onClose} onConfirm={confirm} onRecheck={recheck} />;
}
