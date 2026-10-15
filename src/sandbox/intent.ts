import { DesignIntent } from '../types';

function layoutFromTemplate(template: string | undefined, pageType: string | undefined, payload: any): any {
  if (pageType === 'cover') return 'center';
  if (pageType === 'cta') return 'center';
  if (template === 'timeline') return 'timeline';
  if (template === 'comparison' || template === 'statistics' || payload.stats || payload.comparison) return 'grid';
  return 'split';
}

/** Payload cũ không có `designIntent` v1.0 thì dựng intent từ các trường thô (title, body…). */
export function synthesizeDesignIntent(payload: any): DesignIntent {
  const layoutPattern = layoutFromTemplate(payload.template, payload.pageType, payload);
  const content: any[] = [];

  if (payload.title) {
    content.push({
      type: 'heading',
      text: payload.title,
      size_level: payload.pageType === 'cover' ? 'HeadingXL' : 'HeadingL',
      highlight_words: payload.highlights || [],
    });
  }

  if (payload.body && !payload.stats && !payload.timelineItems && !payload.comparison) {
    content.push({ type: 'body', text: payload.body, size_level: 'BodyS' });
  }

  if (payload.timelineItems) {
    const items = payload.timelineItems.map((item: any) => `${item.title}: ${item.description}`);
    content.push({ type: 'list', title: 'timeline', items });
  }

  if (payload.stats) {
    payload.stats.forEach((stat: any) => {
      content.push({ type: 'statistic', value: stat.number, metric: stat.label });
    });
  }

  if (payload.comparison) {
    content.push({ type: 'list', title: payload.comparison.leftTitle || 'Left', items: payload.comparison.leftItems || [] });
    content.push({ type: 'list', title: payload.comparison.rightTitle || 'Right', items: payload.comparison.rightItems || [] });
  }

  return {
    version: '1.0',
    layout_pattern: layoutPattern,
    theme: payload.designIntent?.theme || 'dark',
    content,
  };
}

export function resolveIntent(payload: any): DesignIntent {
  const intent = payload?.designIntent as DesignIntent | undefined;
  return intent && intent.version === '1.0' ? intent : synthesizeDesignIntent(payload ?? {});
}
