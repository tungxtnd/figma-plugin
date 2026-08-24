import { resolveRenderConstraints, scaleTemplatePx } from '../src/core/pipeline';
import { DesignJob } from '../src/types';

const knowledgeLayout = {
  pageType: 'content' as const,
  layout: 'split' as const,
  template: 'contentClassic',
  logoPosition: 'top-center' as const,
  safeMarginPx: 140,
  spacingPx: 40,
  cornerRadiusPx: 24,
  strokeWidthPx: 6,
  maxTitleLines: 2,
  maxBodyChars: 280,
};

function createJob(overrides: Partial<DesignJob> = {}): DesignJob {
  return {
    assetId: 'asset-1',
    postId: 'post-1',
    orderIndex: 0,
    runId: 'run-1',
    renderedPayload: {
      pageType: 'content',
      template: 'contentClassic',
      designIntent: { version: '2.0', layout_pattern: 'split', theme: 'light', content: [] },
      knowledgeVersion: 'kb-v1',
    },
    knowledgeBase: {
      version: 'kb-v1',
      layouts: [knowledgeLayout],
      tokens: {},
      evidence: { observationCount: 51 },
    },
    ...overrides,
  };
}

describe('knowledge-backed renderer constraints', () => {
  it('uses the active KB constraint when the versions and layout match', () => {
    expect(resolveRenderConstraints(createJob())).toEqual(knowledgeLayout);
  });

  it('keeps payload constraints authoritative even if a KB is present', () => {
    const locked = { ...knowledgeLayout, safeMarginPx: 180 };
    const job = createJob();
    job.renderedPayload.renderConstraints = locked;
    expect(resolveRenderConstraints(job)).toEqual(locked);
  });

  it('does not use a KB from a mismatched version and scales template pixels to the Figma canvas', () => {
    const job = createJob();
    job.knowledgeBase = { ...job.knowledgeBase!, version: 'kb-v2' };
    expect(resolveRenderConstraints(job).safeMarginPx).toBe(120);
    expect(scaleTemplatePx(120)).toBe(86);
  });
});
