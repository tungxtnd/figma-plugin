import { LayoutContext, getHeading, getListComponents } from '../../core/context';
import { createTitle } from '../../components/title';
import { createFooter } from '../../components/chrome';
import { COLOR } from '../../tokens';

export async function renderNumbered(
  parent: FrameNode,
  context: LayoutContext,
  variant: string
): Promise<{ warned: boolean }> {
  const { intent, theme } = context;
  const heading = getHeading(intent);
  const lists = getListComponents(intent);
  let warned = false;

  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  if (heading) await createTitle(parent, context, heading);

  // Steps container
  const stepsContainer = figma.createFrame();
  stepsContainer.name = 'Timeline Numbered Steps';
  stepsContainer.layoutMode = 'VERTICAL';
  stepsContainer.layoutAlign = 'STRETCH';
  stepsContainer.layoutGrow = 1;
  stepsContainer.itemSpacing = 40;
  stepsContainer.fills = [];
  parent.appendChild(stepsContainer);

  const items = lists.length > 0 ? lists[0].items : [];
  const cappedItems = items.slice(0, 3);
  if (items.length > 3) warned = true;

  for (let i = 0; i < cappedItems.length; i++) {
    const row = figma.createFrame();
    row.name = `Numbered Step ${i + 1}`;
    row.layoutMode = 'NONE'; // NONE to place backdrop giant number absolutely
    row.layoutAlign = 'STRETCH';
    row.resize(920, 110);
    stepsContainer.appendChild(row);

    // Giant backdrop number
    const bigNum = figma.createText();
    bigNum.name = 'Giant Backdrop Number';
    bigNum.fontName = { family: 'Inter', style: 'Bold' };
    bigNum.fontSize = 120;
    bigNum.characters = String(i + 1);
    bigNum.fills = [{ type: 'SOLID', color: COLOR.Highlight }];
    bigNum.opacity = 0.12;
    bigNum.resize(100, 120);
    bigNum.x = 0;
    bigNum.y = -10;
    row.appendChild(bigNum);

    // Text Stack positioned on top
    const textStack = figma.createFrame();
    textStack.name = 'Step Content';
    textStack.layoutMode = 'VERTICAL';
    textStack.primaryAxisAlignItems = 'CENTER';
    textStack.counterAxisAlignItems = 'MIN';
    textStack.fills = [];
    textStack.resize(800, 110);
    textStack.x = 90;
    textStack.y = 0;
    row.appendChild(textStack);

    const stepText = figma.createText();
    stepText.fontName = { family: 'Inter', style: 'Regular' };
    stepText.fontSize = 28;
    stepText.characters = cappedItems[i];
    stepText.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    stepText.layoutAlign = 'STRETCH';
    stepText.textAutoResize = 'HEIGHT';
    textStack.appendChild(stepText);
  }

  await createFooter(parent, context);
  return { warned };
}
