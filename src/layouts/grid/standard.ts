import { LayoutContext, getHeading, getListComponents, getStatistics } from '../../core/context';
import { createTitle } from '../../components/title';
import { createListItems } from '../../components/body';
import { createFooter } from '../../components/chrome';
import { LAYOUT, CANVAS, COLOR } from '../../tokens';
import { StatisticComponent } from '../../types';

export async function renderStandard(
  parent: FrameNode,
  context: LayoutContext,
  variant: string
): Promise<{ warned: boolean }> {
  const { intent } = context;
  const heading = getHeading(intent);
  const lists = getListComponents(intent);
  const statistics = getStatistics(intent);
  let warned = false;

  if (heading) {
    await createTitle(parent, context, heading);
  } else {
    warned = true;
  }

  // ── Statistics Grid Mode ─────────────────────────────────────────────────
  if (statistics.length > 0) {
    const statsRow = figma.createFrame();
    statsRow.name = 'Statistics Row';
    statsRow.layoutMode = 'HORIZONTAL';
    statsRow.layoutAlign = 'STRETCH';
    statsRow.layoutGrow = 1;
    statsRow.itemSpacing = LAYOUT.Grid.GapDefault;
    statsRow.fills = [];
    statsRow.counterAxisAlignItems = 'CENTER';
    parent.appendChild(statsRow);

    const statsToDraw = statistics.slice(0, 2);
    for (const stat of statsToDraw) {
      await renderStatBlock(statsRow, context, stat);
    }

    await createFooter(parent, context);
    return { warned };
  }

  // ── Standard Grid Mode ──────────────────────────────────────────────────
  const itemsContainer = figma.createFrame();
  itemsContainer.name = 'Grid Items';
  itemsContainer.layoutMode = 'VERTICAL';
  itemsContainer.layoutAlign = 'STRETCH';
  itemsContainer.layoutGrow = 1;
  itemsContainer.itemSpacing = LAYOUT.Grid.GapDefault;
  itemsContainer.fills = [];
  parent.appendChild(itemsContainer);

  for (const list of lists) {
    if (list.items.length > LAYOUT.Grid.MaxItems) {
      list.items = list.items.slice(0, LAYOUT.Grid.MaxItems);
      warned = true;
    }
    await createListItems(itemsContainer, context, list);
  }

  await createFooter(parent, context);
  return { warned };
}

export async function renderStatBlock(
  parent: FrameNode,
  context: LayoutContext,
  component: StatisticComponent,
): Promise<FrameNode> {
  const { theme } = context;

  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const card = figma.createFrame();
  card.name = 'Stat Block';
  card.layoutMode = 'VERTICAL';
  card.layoutAlign = 'INHERIT';
  card.layoutGrow = 1;
  card.itemSpacing = 8;
  card.paddingTop = 32;
  card.paddingBottom = 32;
  card.paddingLeft = 32;
  card.paddingRight = 32;
  card.cornerRadius = CANVAS.BorderRadius;
  card.fills = [{ type: 'SOLID', color: theme.cardBg }];

  // Value số lớn màu vàng
  const valueNode = figma.createText();
  valueNode.name = 'Stat Value';
  valueNode.fontName = { family: 'Inter', style: 'Bold' };
  valueNode.fontSize = 72;
  valueNode.characters = component.value;
  valueNode.fills = [{ type: 'SOLID', color: theme.highlight }];
  valueNode.textAutoResize = 'WIDTH_AND_HEIGHT';
  card.appendChild(valueNode);

  // Metric label
  const metricNode = figma.createText();
  metricNode.name = 'Stat Metric';
  metricNode.fontName = { family: 'Inter', style: 'Regular' };
  metricNode.fontSize = 28;
  metricNode.characters = component.metric;
  metricNode.fills = [{ type: 'SOLID', color: theme.textPrimary }];
  metricNode.layoutAlign = 'STRETCH';
  metricNode.textAutoResize = 'HEIGHT';
  card.appendChild(metricNode);

  // Trend
  if (component.trend) {
    const trendNode = figma.createText();
    trendNode.name = 'Stat Trend';
    trendNode.fontName = { family: 'Inter', style: 'Bold' };
    trendNode.fontSize = 24;
    trendNode.characters = component.trend;
    trendNode.fills = [{ type: 'SOLID', color: COLOR.Accent.Green }];
    trendNode.textAutoResize = 'WIDTH_AND_HEIGHT';
    card.appendChild(trendNode);
  }

  // Caption
  if (component.caption) {
    const captionNode = figma.createText();
    captionNode.name = 'Stat Caption';
    captionNode.fontName = { family: 'Inter', style: 'Regular' };
    captionNode.fontSize = 22;
    captionNode.characters = component.caption;
    captionNode.fills = [{ type: 'SOLID', color: theme.textMuted }];
    captionNode.layoutAlign = 'STRETCH';
    captionNode.textAutoResize = 'HEIGHT';
    card.appendChild(captionNode);
  }

  parent.appendChild(card);
  return card;
}
