import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { PluginMessage, DesignJob, SyncSlide, DiffResult, ReconciliationPayload } from './types';
import SparkMD5 from 'spark-md5';
import { ApiClient, ApiError } from './services/api-client';

const assetCache = new Map<string, Uint8Array>();

async function fetchAssetWithCache(url: string, addLog: (message: string, status: any) => void): Promise<Uint8Array | null> {
  if (!url) return null;
  if (assetCache.has(url)) {
    return assetCache.get(url)!;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    assetCache.set(url, bytes);
    return bytes;
  } catch (err) {
    addLog(`Failed to fetch asset: ${url} (${(err as Error).message})`, 'warning');
    return null;
  }
}

interface LogItem { id: string; timestamp: string; message: string; status: 'info' | 'success' | 'error' | 'warning'; }

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function App() {
  const [activeTab, setActiveTab] = React.useState<'SYNC' | 'RENDERER' | 'SETTINGS'>('SYNC');
  const [backendUrl, setBackendUrl] = React.useState('https://unrepined-min-unexultantly.ngrok-free.dev/api');
  const [clientSecret, setClientSecret] = React.useState('');
  const [showSecret, setShowSecret] = React.useState(false);
  const [logs, setLogs] = React.useState<LogItem[]>([]);

  // Sync state
  const [postId, setPostId] = React.useState<string>('');
  const [diffResults, setDiffResults] = React.useState<DiffResult[]>([]);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [progress, setProgress] = React.useState<string>('');
  const [currentJobId, setCurrentJobId] = React.useState<string | null>(null);

  const apiClientRef = React.useRef(new ApiClient({ baseUrl: backendUrl, clientId: 'figma-plugin', clientSecret }));


  const addLog = React.useCallback((message: string, status: LogItem['status'] = 'info') => {
    setLogs((prev) => [{
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message, status
    }, ...prev].slice(0, 100));
  }, []);

  const handleApiError = React.useCallback((err: unknown, defaultMsg: string) => {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        addLog(`[Auth Error] 401 Unauthorized: ${err.message}`, 'error');
      } else if (err.status === 403) {
        addLog(`[Auth Error] 403 Forbidden: ${err.message}`, 'error');
      } else if (err.status === 409) {
        addLog(`[Conflict Error] 409 Version Conflict: ${err.message}`, 'warning');
      } else if (err.status === 429) {
        addLog(`[Rate Limit] 429 Too Many Requests: ${err.message}`, 'warning');
      } else if (err.code === 'NO_SECRET') {
        addLog(`[Auth Warning] ${err.message}`, 'warning');
      } else {
        addLog(`${defaultMsg}: ${err.message}`, 'error');
      }
    } else {
      addLog(`${defaultMsg}: ${(err as Error).message}`, 'error');
    }
  }, [addLog]);

  const sendToSandbox = (msg: PluginMessage) => parent.postMessage({ pluginMessage: msg }, '*');

  React.useEffect(() => {
    window.onmessage = async (event) => {
      const msg: PluginMessage = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'log') {
        addLog(msg.message, msg.status);
      }

      if (msg.type === 'config-loaded') {
        const { config } = msg;
        setBackendUrl(config.backendUrl || 'https://unrepined-min-unexultantly.ngrok-free.dev/api');
        setClientSecret(config.clientSecret || '');

        apiClientRef.current.updateConfig({
          baseUrl: config.backendUrl || 'https://unrepined-min-unexultantly.ngrok-free.dev/api',
          clientSecret: config.clientSecret || '',
        });

        if (!config.clientSecret || config.clientSecret.trim().length === 0) {
          addLog('[Auth Warning] Authentication not configured. Please enter Client Secret in Settings.', 'warning');
        } else {
          addLog('🔑 M2M HMAC Auth initialized (SHA-256 Signature Enabled).', 'info');
        }
      }

      if (msg.type === 'canvas-scanned') {
        setIsScanning(false);
        const { slides } = msg as any;
        addLog(`Canvas scanned. Found ${slides.length} slides. Processing fingerprints...`, 'info');

        let activePostId = postId;
        if (!activePostId && slides.length > 0) {
          const slideWithPost = slides.find((s: any) => s.pluginPostId);
          if (slideWithPost) {
            activePostId = slideWithPost.pluginPostId;
            setPostId(activePostId);
            addLog(`Auto-detected Target Post ID: ${activePostId}`, 'success');
          }
        }

        if (!activePostId) {
          addLog(`No Target Post ID provided and could not auto-detect from canvas.`, 'error');
          return;
        }

        try {
          // 1. Fetch remote expected designs via ApiClient
          const jsonRes = await apiClientRef.current.get<{ data: any[] }>(`/content/posts/${activePostId}/designs`);
          const remoteDesigns = jsonRes?.data || [];

          const remoteMap = new Map((remoteDesigns || []).map((d: any) => [d.assetId, d]));
          const diffs: DiffResult[] = [];

          for (const slide of slides) {
            // Hash the serialized payload
            const hash = SparkMD5.hash(slide.fingerprint);
            let action: 'CREATE' | 'UPDATE' | 'UNCHANGED' = 'CREATE';

            if (slide.pluginAssetId && remoteMap.has(slide.pluginAssetId)) {
              const remote = remoteMap.get(slide.pluginAssetId);
              if (remote.fingerprint === hash) {
                action = 'UNCHANGED';
              } else {
                action = 'UPDATE';
              }
              remoteMap.delete(slide.pluginAssetId);
            }

            diffs.push({
              figmaNodeId: slide.figmaNodeId,
              assetId: slide.pluginAssetId,
              version: slide.version || 1,
              orderIndex: slide.orderIndex,
              fingerprint: hash,
              action
            });
          }

          // 2. Identify deleted designs (present in remoteDesigns but missing from figma canvas)
          for (const [assetId, remote] of remoteMap.entries()) {
            diffs.push({
              figmaNodeId: remote.figmaNodeId || '',
              assetId: assetId,
              version: remote.version || 1,
              orderIndex: -1,
              fingerprint: remote.fingerprint || '',
              action: 'DELETE'
            });
          }

          setDiffResults(diffs);
          addLog(`Diff generated: ${diffs.filter(d => d.action !== 'UNCHANGED').length} changes detected.`, 'success');
        } catch (err) {
          handleApiError(err, 'Failed to generate diff');
        }
      }

      if (msg.type === 'frames-exported') {
        const { exports } = msg as any;
        setProgress('Uploading to NestJS...');

        try {
          const txId = uuidv4();
          const form = new FormData();
          const payload: ReconciliationPayload = {
            changes: diffResults.filter(d => d.action !== 'UNCHANGED').map(d => ({
              ...d,
              fileFieldName: d.action === 'DELETE' ? undefined : `slide_${d.figmaNodeId}`
            } as any))
          };

          form.append('changes', JSON.stringify(payload));

          for (const exp of exports) {
            const blob = new Blob([exp.bytes], { type: 'image/png' });
            form.append(`slide_${exp.nodeId}`, blob, `${exp.nodeId}.png`);
          }

          const jsonRes = await apiClientRef.current.postFormData<{ results: any[] }>(`/content/posts/${postId}/sync-canvas`, form, {
            headers: { 'X-Transaction-ID': txId }
          });

          const results = jsonRes?.results || [];

          addLog('✅ Sync completed successfully!', 'success');

          // Commit metadata back to nodes (skip deleted ones)
          const updates = diffResults
            .filter(d => d.action !== 'UNCHANGED' && d.action !== 'DELETE')
            .map(d => {
              const serverResult = results.find((r: any) => r.figmaNodeId === d.figmaNodeId);
              const realAssetId = serverResult ? serverResult.assetId : (d.assetId || uuidv4());
              return {
                figmaNodeId: d.figmaNodeId,
                postId,
                assetId: realAssetId,
                version: (d.version || 0) + 1,
                fingerprint: d.fingerprint
              };
            });

          if (updates.length > 0) {
            sendToSandbox({
              type: 'commit-metadata',
              updates
            } as any);
          }

          setDiffResults(prevDiffs => prevDiffs.filter(d => d.action !== 'DELETE').map(d => ({ ...d, action: 'UNCHANGED' })));
        } catch (uploadErr) {
          handleApiError(uploadErr, 'Upload failed');
        } finally {
          setIsSyncing(false);
          setProgress('');
        }
      }

      if (msg.type === 'job-rendered') {
        const { assetId, bytes, fileName, renderResult, rawFingerprint } = msg as any;
        addLog(`Uploading render result for ${assetId}...`, 'info');

        try {
          const hash = rawFingerprint ? SparkMD5.hash(rawFingerprint) : '';
          const figmaNodeId = renderResult?.figmaNodeId || '';

          if (hash && figmaNodeId) {
            sendToSandbox({
              type: 'commit-rendered-fingerprint',
              assetId,
              figmaNodeId,
              fingerprint: hash
            } as any);
          }

          const form = new FormData();
          form.append('file', new Blob([bytes], { type: 'image/png' }), fileName);
          if (renderResult) {
            renderResult.fingerprint = hash;
            form.append('renderResult', JSON.stringify(renderResult));
          }

          await apiClientRef.current.postFormData(`/designs/${assetId}/render-result`, form);

          addLog(`✅ Successfully uploaded design ${assetId}`, 'success');
        } catch (err) {
          handleApiError(err, `Failed to upload design ${assetId}`);
        } finally {
          setCurrentJobId(null);
        }
      }

      if (msg.type === 'job-failed') {
        setCurrentJobId(null);
      }
    };

    sendToSandbox({ type: 'ui-ready' });
    sendToSandbox({ type: 'get-config' });
  }, [postId, diffResults, handleApiError]);

  // Auto-renderer polling
  React.useEffect(() => {
    if (activeTab !== 'RENDERER') return;
    let isPolling = true;
    let timeoutId: any;

    const poll = async () => {
      if (!isPolling) return;

      if (currentJobId) {
        timeoutId = setTimeout(poll, 3000);
        return;
      }

      try {
        const jsonRes = await apiClientRef.current.get<{ data: any[] }>('/designs/pending');
        const data = jsonRes?.data;
        if (data && data.length > 0) {
          const job = data[0];

          setCurrentJobId(job.assetId);
          setPostId(job.postId); // Tự động cập nhật Target Post ID cho Sync Tab
          addLog(`Processing slide ${job.orderIndex + 1} (assetId: ${job.assetId})...`, 'info');

          const backgroundUrl = job.renderedPayload?.backgroundUrl;
          const logoUrl = job.renderedPayload?.logoUrl;
          const imageUrls: string[] = job.renderedPayload?.imageUrls || job.renderedPayload?.images || [];

          // Fetch background, logo, and content images in parallel from external CDNs (no Auth headers)
          const [bgBytes, logoBytes, ...contentImagesBytes] = await Promise.all([
            backgroundUrl ? fetchAssetWithCache(backgroundUrl, addLog) : Promise.resolve(null),
            logoUrl ? fetchAssetWithCache(logoUrl, addLog) : Promise.resolve(null),
            ...imageUrls.map(url => fetchAssetWithCache(url, addLog))
          ]);

          const images = imageUrls.map((url, index) => ({
            url,
            bytes: contentImagesBytes[index]
          })).filter(img => img.bytes !== null) as { url: string; bytes: Uint8Array }[];

          sendToSandbox({
            type: 'process-job',
            job,
            images,
            bgBytes: bgBytes || undefined,
            logoBytes: logoBytes || undefined
          } as any);
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === 'NO_SECRET') {
          addLog('[Auth Warning] Polling paused. Please configure Client Secret in Settings.', 'warning');
        } else if (err instanceof ApiError) {
          addLog(`[Polling Error] ${err.status} ${err.code}: ${err.message}`, 'error');
        } else {
          addLog(`[Polling Error] ${(err as Error).message}`, 'error');
        }
      }

      if (isPolling) {
        timeoutId = setTimeout(poll, 3000);
      }
    };

    poll();
    return () => {
      isPolling = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeTab, currentJobId, addLog]);

  const handleScan = () => {
    if (!apiClientRef.current.hasValidCredentials()) {
      addLog('[Auth Warning] Authentication not configured. Please enter Client Secret in Settings.', 'warning');
      setActiveTab('SETTINGS');
      return;
    }
    setIsScanning(true);
    setDiffResults([]);
    sendToSandbox({ type: 'scan-canvas', postId } as any);
  };

  const handleSync = () => {
    if (!apiClientRef.current.hasValidCredentials()) {
      addLog('[Auth Warning] Authentication not configured. Please enter Client Secret in Settings.', 'warning');
      setActiveTab('SETTINGS');
      return;
    }
    const hasChanges = diffResults.some(d => d.action !== 'UNCHANGED');
    if (!hasChanges) return addLog('No changes to sync.', 'warning');

    const toExport = diffResults.filter(d => d.action !== 'UNCHANGED' && d.action !== 'DELETE');

    setIsSyncing(true);
    if (toExport.length > 0) {
      setProgress(`Exporting ${toExport.length} frames...`);
      sendToSandbox({ type: 'export-frames', nodeIds: toExport.map(d => d.figmaNodeId) } as any);
    } else {
      // Only deletions or reorders, trigger upload directly!
      window.postMessage({ pluginMessage: { type: 'frames-exported', exports: [] } }, '*');
    }
  };

  const handleSaveSettings = () => {
    apiClientRef.current.updateConfig({
      baseUrl: backendUrl,
      clientSecret: clientSecret,
    });
    sendToSandbox({
      type: 'save-config',
      config: { backendUrl, clientSecret }
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logoContainer}>
          <div style={styles.logoDot}></div>
          <span style={styles.logoText}>Figma Design Sync v2</span>
        </div>
        {!clientSecret && (
          <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 'bold' }}>⚠️ Auth Unconfigured</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button style={activeTab === 'SYNC' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('SYNC')}>Manual Sync</button>
        <button style={activeTab === 'RENDERER' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('RENDERER')}>Auto Renderer</button>
        <button style={activeTab === 'SETTINGS' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('SETTINGS')}>⚙️ Settings</button>
      </div>

      {activeTab === 'SYNC' && (
        <div style={styles.card}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Target Post ID</label>
            <input style={styles.input} value={postId} onChange={e => setPostId(e.target.value)} disabled={isScanning || isSyncing} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button style={{ ...styles.button, flex: 1, backgroundColor: '#374151' }} onClick={handleScan} disabled={isScanning || isSyncing}>
              {isScanning ? 'Scanning...' : '1. Scan Canvas'}
            </button>
            <button style={{ ...styles.button, flex: 1, backgroundColor: '#2563EB' }} onClick={handleSync} disabled={isScanning || isSyncing || diffResults.length === 0}>
              {isSyncing ? 'Syncing...' : '2. Sync Changes'}
            </button>
          </div>

          {progress && <div style={{ marginTop: '12px', fontSize: '11px', color: '#10B981', textAlign: 'center' }}>{progress}</div>}

          {diffResults.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={styles.cardTitle}>Diff Report ({diffResults.filter(d => d.action !== 'UNCHANGED').length} changes)</div>
              <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                {diffResults.map((diff, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '6px', borderBottom: '1px solid #374151' }}>
                    <span>Slide {i + 1} ({diff.figmaNodeId})</span>
                    <span style={{ color: diff.action === 'CREATE' ? '#10B981' : diff.action === 'UPDATE' ? '#F59E0B' : '#6B7280' }}>
                      {diff.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'RENDERER' && (
        <div style={styles.card}>
          <div style={{ color: '#10B981', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
            Auto-Renderer engine is active and polling for jobs...
            {currentJobId && <div style={{ marginTop: '8px', color: '#F59E0B' }}>Currently processing: {currentJobId}</div>}
          </div>
        </div>
      )}

      {activeTab === 'SETTINGS' && (
        <div style={styles.card}>
          <div style={{ ...styles.cardTitle, marginBottom: '12px' }}>Authentication & Server Credentials</div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Backend API Base URL</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                value={backendUrl}
                onChange={e => setBackendUrl(e.target.value)}
                placeholder="https://your-ngrok-url.ngrok-free.dev/api"
              />
              <button
                type="button"
                style={{ ...styles.button, backgroundColor: '#DC2626', padding: '6px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                onClick={() => setBackendUrl('https://unrepined-min-unexultantly.ngrok-free.dev/api')}
              >
                🔄 Ngrok
              </button>
            </div>
            {backendUrl.includes('localhost') && (
              <div style={{ fontSize: '10px', color: '#F59E0B', marginTop: '4px' }}>
                ⚠️ URL đang trỏ localhost — nếu dùng ngrok hãy nhấn 🔄 Ngrok hoặc sửa thủ công.
              </div>
            )}
          </div>

          <div style={{ ...styles.inputGroup, marginTop: '12px' }}>
            <label style={styles.label}>Client Secret (x-client-secret)</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                placeholder="Paste sk_figma_secret_key here..."
              />
              <button
                type="button"
                style={{ ...styles.button, backgroundColor: '#374151', padding: '6px 10px', fontSize: '12px' }}
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '10px', lineHeight: '1.4' }}>
            🔑 M2M Auth uses Client-ID <code>figma-plugin</code>. Secret is persisted securely in Figma <code>clientStorage</code>.
          </div>

          <button
            style={{ ...styles.button, width: '100%', backgroundColor: '#10B981', marginTop: '16px' }}
            onClick={handleSaveSettings}
          >
            Save Settings
          </button>
        </div>
      )}

      <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={styles.cardTitle}>Activity Logs</div>
        <div style={styles.logsContainer}>
          {logs.map(log => (
            <div key={log.id} style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#6B7280', flexShrink: 0 }}>[{log.timestamp}]</span>
              <span style={{ color: log.status === 'error' ? '#EF4444' : log.status === 'success' ? '#10B981' : log.status === 'warning' ? '#F59E0B' : '#D1D5DB' }}>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', padding: '16px', backgroundColor: '#1E1E1E', color: '#F3F4F6' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  logoContainer: { display: 'flex', alignItems: 'center', gap: '8px' },
  logoDot: { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3B82F6' },
  logoText: { fontWeight: 'bold', fontSize: '15px' },
  card: { backgroundColor: '#2A2A2A', borderRadius: '8px', padding: '16px', marginBottom: '14px', border: '1px solid #374151' },
  cardTitle: { margin: 0, fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '11px', color: '#9CA3AF' },
  input: { backgroundColor: '#1F2937', border: '1px solid #4B5563', borderRadius: '4px', padding: '8px', color: '#F3F4F6', fontSize: '12px' },
  button: { padding: '10px', borderRadius: '6px', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' },
  logsContainer: { flex: 1, backgroundColor: '#111827', borderRadius: '6px', padding: '10px', fontFamily: 'monospace', fontSize: '11px', overflowY: 'auto', marginTop: '8px' },
  tab: { flex: 1, padding: '8px', backgroundColor: '#2A2A2A', border: 'none', color: '#9CA3AF', borderRadius: '4px', cursor: 'pointer' },
  tabActive: { flex: 1, padding: '8px', backgroundColor: '#3B82F6', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};

createRoot(document.getElementById('react-page')!).render(<App />);
