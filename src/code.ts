import { PluginConfig, SandboxToUi, UiToSandbox } from './shared/messages';
import { findSection, getWorkPage, postSections, sectionOf, sectionPostId, sectionState } from './sandbox/canvas';
import { renderJob } from './sandbox/render';
import { commitSync, exportFrames, scanSection } from './sandbox/sync';

figma.showUI(__html__, { width: 360, height: 600, themeColors: true });

const KEYS = {
  backendUrl: 'CAPI_BACKEND_URL',
  token: 'FIGMA_PLUGIN_TOKEN',
  autoRender: 'CAPI_AUTO_RENDER',
  webAppUrl: 'CAPI_WEB_APP_URL',
} as const;

function send(message: SandboxToUi): void {
  figma.ui.postMessage(message);
}

async function loadConfig(): Promise<PluginConfig> {
  const [backendUrl, token, autoRender, webAppUrl] = await Promise.all([
    figma.clientStorage.getAsync(KEYS.backendUrl),
    figma.clientStorage.getAsync(KEYS.token),
    figma.clientStorage.getAsync(KEYS.autoRender),
    figma.clientStorage.getAsync(KEYS.webAppUrl),
  ]);
  return {
    backendUrl: typeof backendUrl === 'string' ? backendUrl : '',
    token: typeof token === 'string' ? token : '',
    // Mặc định bật: mở plugin là tự dựng.
    autoRender: autoRender !== false,
    webAppUrl: typeof webAppUrl === 'string' ? webAppUrl : null,
  };
}

async function saveConfig(config: PluginConfig): Promise<void> {
  await Promise.all([
    figma.clientStorage.setAsync(KEYS.backendUrl, config.backendUrl),
    figma.clientStorage.setAsync(KEYS.token, config.token),
    figma.clientStorage.setAsync(KEYS.autoRender, config.autoRender),
    figma.clientStorage.setAsync(KEYS.webAppUrl, config.webAppUrl ?? ''),
  ]);
}

// ── Trạng thái canvas: Section nào có, cái nào đã sửa chưa gửi ─────────────

async function publishCanvas(): Promise<void> {
  const page = await getWorkPage();
  send({ type: 'canvas', sections: postSections(page).map(sectionState) });
}

let canvasTimer: ReturnType<typeof setTimeout> | undefined;
/** Người dùng sửa liên tục thì gom lại, tính fingerprint một lần khi họ dừng tay. */
function publishCanvasSoon(): void {
  if (canvasTimer) clearTimeout(canvasTimer);
  canvasTimer = setTimeout(() => {
    canvasTimer = undefined;
    void publishCanvas();
  }, 800);
}

function publishSelection(): void {
  const node = figma.currentPage.selection[0] ?? null;
  const section = sectionOf(node);
  send({ type: 'selection', postId: section ? sectionPostId(section) : null });
}

async function startWatching(): Promise<void> {
  const page = await getWorkPage();
  page.on('nodechange', publishCanvasSoon);
  figma.on('selectionchange', publishSelection);
  figma.on('currentpagechange', publishSelection);
}

// ── Message từ UI ───────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: UiToSandbox) => {
  try {
    switch (msg.type) {
      case 'init': {
        send({ type: 'config', config: await loadConfig() });
        await publishCanvas();
        publishSelection();
        await startWatching();
        return;
      }
      case 'save-config':
        await saveConfig(msg.config);
        return;
      case 'render-job':
        await renderJob(msg, send);
        await publishCanvas();
        return;
      case 'scan-section':
        await scanSection(msg.postId, send);
        return;
      case 'export-frames':
        await exportFrames(msg.requestId, msg.nodeIds, msg.scale, send);
        return;
      case 'commit-sync':
        await commitSync(msg.postId, msg.updates);
        await publishCanvas();
        return;
      case 'focus-post': {
        const page = await getWorkPage();
        const section = findSection(page, msg.postId);
        if (!section) return;
        if (figma.currentPage !== page) await figma.setCurrentPageAsync(page);
        figma.currentPage.selection = [section];
        figma.viewport.scrollAndZoomIntoView([section]);
        return;
      }
      case 'remove-sections': {
        const page = await getWorkPage();
        for (const postId of msg.postIds) findSection(page, postId)?.remove();
        await publishCanvas();
        return;
      }
      case 'notify':
        figma.notify(msg.message, { error: !!msg.error, timeout: msg.error ? 6000 : 3000 });
        return;
      case 'open-external':
        figma.openExternal(msg.url);
        return;
    }
  } catch (err) {
    send({
      type: 'log',
      level: 'error',
      message: 'Plugin gặp lỗi khi xử lý trên canvas.',
      detail: (err as Error)?.message || String(err),
    });
  }
};
