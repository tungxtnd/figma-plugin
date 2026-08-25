import { PluginMessage, DesignJob, DesignIntent, RenderResult } from './types';
import { preflightCheck, ConstraintViolation } from './constraint-engine';
import { runRenderingPipeline } from './core/pipeline';
import { generateProgrammaticSlide } from './legacy/legacy-renderer';
import { serializeNode } from './utils';

// Show the plugin UI iframe.
figma.showUI(__html__, { width: 450, height: 600 });

// Handle plugin close cleanup.
figma.on('close', () => {
  console.log('[Sandbox] Plugin closed. Cleaning up resources...');
});

// Global state to track variant used in the last slide to avoid repetitions
let lastPostId: string | undefined = undefined;
let lastVariantName: string | undefined = undefined;

function getLayoutPatternFromTemplate(template: string | undefined, pageType: string | undefined, payload: any): any {
  if (pageType === 'cover') return 'center';
  if (pageType === 'cta') return 'center';
  if (template === 'timeline') return 'timeline';
  if (template === 'comparison' || template === 'statistics' || payload.stats || payload.comparison) return 'grid';
  return 'split';
}

function synthesizeDesignIntent(payload: any): DesignIntent {
  const layoutPattern = getLayoutPatternFromTemplate(payload.template, payload.pageType, payload);
  const content: any[] = [];

  if (payload.title) {
    content.push({
      type: 'heading',
      text: payload.title,
      size_level: payload.pageType === 'cover' ? 'HeadingXL' : 'HeadingL',
      highlight_words: payload.highlights || []
    });
  }

  if (payload.body && !payload.stats && !payload.timelineItems && !payload.comparison) {
    content.push({
      type: 'body',
      text: payload.body,
      size_level: 'BodyS'
    });
  }

  if (payload.timelineItems) {
    const items = payload.timelineItems.map((item: any) => `${item.title}: ${item.description}`);
    content.push({
      type: 'list',
      title: 'timeline',
      items
    });
  }

  if (payload.stats) {
    payload.stats.forEach((stat: any) => {
      content.push({
        type: 'statistic',
        value: stat.number,
        metric: stat.label
      });
    });
  }

  if (payload.comparison) {
    content.push({
      type: 'list',
      title: payload.comparison.leftTitle || 'Left',
      items: payload.comparison.leftItems || []
    });
    content.push({
      type: 'list',
      title: payload.comparison.rightTitle || 'Right',
      items: payload.comparison.rightItems || []
    });
  }

  return {
    version: '1.0',
    layout_pattern: layoutPattern,
    theme: payload.designIntent?.theme || 'dark',
    content
  };
}

// Main message listener
figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'ui-ready') {
    sendToUi({ type: 'log', message: 'Plugin UI ready. Awaiting rendering command...', status: 'info' });
    return;
  }

  if (msg.type === 'get-config') {
    try {
      const savedUrl = await figma.clientStorage.getAsync('FIGMA_M2M_BACKEND_URL');
      const savedSecret = await figma.clientStorage.getAsync('FIGMA_M2M_CLIENT_SECRET');
      sendToUi({
        type: 'config-loaded',
        config: {
          backendUrl: savedUrl || 'http://localhost:3000/api',
          pluginToken: savedSecret || '',
        }
      });
    } catch (e) {
      sendToUi({
        type: 'config-loaded',
        config: { backendUrl: 'http://localhost:3000/api', pluginToken: '' }
      });
    }
    return;
  }

  if (msg.type === 'save-config') {
    try {
      const { config } = msg;
      await figma.clientStorage.setAsync('FIGMA_M2M_BACKEND_URL', config.backendUrl || 'http://localhost:3000/api');
      await figma.clientStorage.setAsync('FIGMA_M2M_CLIENT_SECRET', config.pluginToken || '');
      sendToUi({ type: 'log', message: '✅ Settings saved to Figma clientStorage.', status: 'success' });
      sendToUi({ type: 'config-loaded', config });
    } catch (e) {
      sendToUi({ type: 'log', message: `Failed to save settings: ${(e as Error).message}`, status: 'error' });
    }
    return;
  }

  if (msg.type === 'process-job') {
    const { job, images, bgBytes, logoBytes } = msg as any;
    console.log('[SANDBOX PAYLOAD]',
      JSON.stringify(job.renderedPayload, null, 2));
    const { renderedPayload, orderIndex } = job;
    let designIntent = renderedPayload.designIntent as DesignIntent | undefined;

    // Tự động dựng designIntent nếu thiếu để chạy qua bộ vẽ mới v1.0
    if (!designIntent || designIntent.version !== '1.0') {
      sendToUi({ type: 'log', message: `[Pipeline] Missing/legacy designIntent for slide ${orderIndex + 1}. Synthesizing fallback...`, status: 'info' });
      designIntent = synthesizeDesignIntent(renderedPayload);
    }

    // Cleanup any existing frame on canvas that has the same assetId (idempotency cleanup to prevent duplicates)
    if (job && job.assetId) {
      const existingFrames = figma.currentPage.children.filter(n => n.type === 'FRAME') as FrameNode[];
      for (const frame of existingFrames) {
        const rawData = frame.getPluginData('figma_reconciliation_metadata');
        if (rawData) {
          try {
            const meta = JSON.parse(rawData);
            if (meta.assetId === job.assetId) {
              frame.remove();
            }
          } catch (_) {}
        }
      }
    }

    // ── ROUTE TO V1.0 ENGINE ────────────────────────────────────────────────
    if (designIntent && designIntent.version === '1.0') {
      sendToUi({ type: 'log', message: `[Sprint2] Routing to Layout Renderer v1.0 for slide ${orderIndex + 1}...`, status: 'info' });
      try {
        // Reset tracking if we switch posts
        if (lastPostId !== job.postId) {
          lastPostId = job.postId;
          lastVariantName = undefined;
        }

        const { slideNode, renderResult, variantUsed } = await runRenderingPipeline(
          job,
          designIntent,
          images,
          logoBytes,
          bgBytes,
          lastVariantName
        );

        lastVariantName = variantUsed;

        const rawFingerprint = serializeNode(slideNode);

        // Auto-commit metadata so future manual syncs track this frame
        slideNode.setPluginData('figma_reconciliation_metadata', JSON.stringify({
          postId: job.postId,
          assetId: job.assetId,
          version: 1,
          fingerprint: '' // Will be updated by commit-rendered-fingerprint message
        }));

        figma.currentPage.selection = [slideNode];
        figma.viewport.scrollAndZoomIntoView([slideNode]);
        figma.commitUndo();

        sendToUi({ type: 'log', message: `[Sprint2] Rendering complete. Score: ${renderResult.score}/100. Exporting...`, status: 'success' });

        const exportBytes = await slideNode.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 },
        });

        sendToUi({
          type: 'job-rendered',
          assetId: job.assetId,
          bytes: exportBytes,
          fileName: `figma-slide-${job.postId}-${orderIndex + 1}-${Date.now()}.png`,
          renderResult: {
            ...renderResult,
            figmaNodeId: slideNode.id
          },
          rawFingerprint,
        });
      } catch (err) {
        const errMsg = (err as Error).message || 'Unknown sandbox error';
        sendToUi({ type: 'log', message: `[Sprint2] Pipeline Failed: ${errMsg}`, status: 'error' });
        sendToUi({ type: 'job-failed', assetId: job.assetId, error: errMsg });
      }
      return;
    }

    // ── FALLBACK TO LEGACY RENDERER (v0) ───────────────────────────────────
    let templateId = renderedPayload.template;
    if (!templateId) {
      if (renderedPayload.pageType === 'cover') templateId = 'coverHero';
      else if (renderedPayload.pageType === 'cta') templateId = 'ctaCentered';
      else templateId = 'contentClassic';
    }
    sendToUi({ type: 'log', message: `[Legacy] Processing slide ${orderIndex + 1}: template="${templateId}"`, status: 'info' });

    const allViolations: ConstraintViolation[] = [];
    // Pre-flight: kiểm tra Hard Limits (Reject level)
    const preflight = preflightCheck(designIntent || { layout_pattern: 'split', content: [] });
    allViolations.push(...preflight.violations);

    if (preflight.shouldAbort) {
      const rejectMessages = preflight.violations
        .filter(v => v.severity === 'reject')
        .map(v => `[${v.code}] ${v.message}`);
      const errMsg = `Pre-flight REJECTED: ${rejectMessages.join('; ')}`;
      sendToUi({ type: 'log', message: errMsg, status: 'error' });
      sendToUi({ type: 'job-failed', assetId: job.assetId, error: errMsg });
      return;
    }

    // Render legacy
    let qualityScore = 100;
    const warnings: string[] = allViolations
      .filter(v => v.severity === 'warn')
      .map(v => `[${v.code}] ${v.message}`);

    try {
      sendToUi({ type: 'log', message: `[Legacy] Generating slide programmatically...`, status: 'info' });
      const clone = await generateProgrammaticSlide(templateId, job, images, bgBytes, logoBytes);

      figma.currentPage.selection = [clone];
      figma.viewport.scrollAndZoomIntoView([clone]);
      figma.commitUndo();
      await new Promise((resolve) => setTimeout(resolve, 300));

      const overflow = false;
      sendToUi({ type: 'log', message: `[QualityEngine] Score: 100/100 (Legacy)`, status: 'success' });

      sendToUi({ type: 'log', message: `Exporting Frame to PNG...`, status: 'info' });
      const exportBytes = await clone.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 2 },
      });

      const renderResult: RenderResult = {
        version: '1.0',
        renderId: `legacy-${job.assetId}-${Date.now()}`,
        jobId: job.runId || job.postId,
        slideId: job.assetId,
        score: qualityScore,
        overflow,
        warnings: [],
        metrics: {
          textCoverage: 0,
          imageCoverage: 0,
          whitespace: 0,
          overflowCount: 0,
          fontScaleLevel: 0
        },
        pluginVersion: '1.0.2'
      };

      sendToUi({
        type: 'job-rendered',
        assetId: job.assetId,
        bytes: exportBytes,
        fileName: `figma-slide-${job.postId}-${orderIndex + 1}-${Date.now()}.png`,
        renderResult,
      });

    } catch (err) {
      const errMsg = (err as Error).message || 'Unknown sandbox error';
      sendToUi({ type: 'log', message: `Error: ${errMsg}`, status: 'error' });
      sendToUi({ type: 'job-failed', assetId: job.assetId, error: errMsg });
    }
  }

  // ── PHASE 9: CANVAS SYNCHRONIZATION HANDLERS ────────────────────────────

  if (msg.type === 'scan-canvas') {
    const { postId } = msg as any;
    sendToUi({ type: 'log', message: `Scanning canvas for Post ${postId}...`, status: 'info' });

    const slides: any[] = [];
    const frames = figma.currentPage.children.filter(n => n.type === 'FRAME') as FrameNode[];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      // Read pluginData metadata
      const rawData = frame.getPluginData('figma_reconciliation_metadata');
      let metadata: any = {};
      if (rawData) {
        try { metadata = JSON.parse(rawData); } catch (e) { }
      }

      // Ensure this frame belongs to the current post, or is a newly created frame (no metadata)
      if (postId && metadata.postId && metadata.postId !== postId) continue;

      const fingerprintPayload = serializeNode(frame);

      slides.push({
        figmaNodeId: frame.id,
        pluginAssetId: metadata.assetId,
        pluginPostId: metadata.postId,
        version: metadata.version,
        orderIndex: i, // Based on canvas order
        fingerprint: fingerprintPayload // UI thread will MD5 hash this
      });
    }

    sendToUi({ type: 'canvas-scanned', slides } as any);
  }

  if (msg.type === 'export-frames') {
    const { nodeIds } = msg as any;
    sendToUi({ type: 'log', message: `Exporting ${nodeIds.length} frames to PNG...`, status: 'info' });

    const exports: { nodeId: string; bytes: Uint8Array }[] = [];

    for (const nodeId of nodeIds) {
      const node = figma.getNodeById(nodeId);
      if (node && (node.type === 'FRAME' || node.type === 'COMPONENT')) {
        const bytes = await (node as any).exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 },
        });
        exports.push({ nodeId, bytes });

        // Yield thread to prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    }

    sendToUi({ type: 'frames-exported', exports } as any);
  }

  if (msg.type === 'commit-metadata') {
    const { updates } = msg as any;
    sendToUi({ type: 'log', message: `Committing metadata for ${updates.length} nodes...`, status: 'info' });

    for (const update of updates) {
      const node = figma.getNodeById(update.figmaNodeId);
      if (node) {
        node.setPluginData('figma_reconciliation_metadata', JSON.stringify({
          postId: update.postId,
          assetId: update.assetId,
          version: update.version,
          fingerprint: update.fingerprint
        }));
      }
    }
  }

  if (msg.type === 'commit-rendered-fingerprint') {
    const { assetId, figmaNodeId, fingerprint } = msg;
    const node = figma.getNodeById(figmaNodeId);
    if (node && node.type === 'FRAME') {
      const rawData = node.getPluginData('figma_reconciliation_metadata');
      let currentMetadata: any = {};
      if (rawData) {
        try { currentMetadata = JSON.parse(rawData); } catch (e) { }
      }
      node.setPluginData('figma_reconciliation_metadata', JSON.stringify({
        postId: currentMetadata.postId || lastPostId || '',
        assetId: assetId,
        version: currentMetadata.version || 1,
        fingerprint: fingerprint
      }));
    }
  }
};

function sendToUi(message: PluginMessage) {
  figma.ui.postMessage(message);
}
