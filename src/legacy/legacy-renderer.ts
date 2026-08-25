import { DesignJob } from '../types';
import { COLOR, CANVAS } from '../tokens';

// ─── Design Tokens (v1.0) — Alias để tương thích với component functions cũ ───
const TOKENS = {
  canvasSize: CANVAS.Size,
  padding: CANVAS.Padding,
  spacing: CANVAS.Spacing,
  borderRadius: CANVAS.BorderRadius,
  colors: {
    bg: COLOR.Primary,
    text: COLOR.TextPrimaryDark,
    textMuted: COLOR.TextMuted,
    accent: COLOR.Highlight,
    red: COLOR.Accent.Red,
    green: COLOR.Accent.Green,
    cardBg: COLOR.CardBg,
    cardBgLight: COLOR.CardBgLight,
  },
};

// Component Library: 2. Brand Logo Component
function createLogoComponent(parent: FrameNode, theme: string, position: string, logoBytes?: Uint8Array): FrameNode {
  const logoFrame = figma.createFrame();
  logoFrame.name = 'Capi Demy Logo';
  logoFrame.layoutMode = 'HORIZONTAL';
  logoFrame.primaryAxisAlignItems = position === 'top-center' && !parent.name.toLowerCase().includes('cover') ? 'MIN' : 'CENTER';
  logoFrame.counterAxisAlignItems = 'CENTER';
  logoFrame.itemSpacing = 12;
  logoFrame.fills = [];
  
  if (logoBytes) {
    const logoNode = figma.createFrame();
    logoNode.name = 'Logo Image';
    logoNode.resize(240, 64);
    const image = figma.createImage(logoBytes);
    logoNode.fills = [{
      type: 'IMAGE',
      scaleMode: 'FIT',
      imageHash: image.hash
    }];
    logoFrame.appendChild(logoNode);
  } else {
    const emblem = figma.createFrame();
    emblem.name = 'Emblem';
    emblem.resize(40, 40);
    emblem.cornerRadius = 10;
    emblem.fills = [{ type: 'SOLID', color: TOKENS.colors.bg }];
    emblem.strokes = [{ type: 'SOLID', color: TOKENS.colors.accent }];
    emblem.strokeWeight = 2;
    emblem.layoutMode = 'HORIZONTAL';
    emblem.primaryAxisAlignItems = 'CENTER';
    emblem.counterAxisAlignItems = 'CENTER';
    
    const emblemText = figma.createText();
    emblemText.fontName = { family: 'Inter', style: 'Bold' };
    emblemText.fontSize = 20;
    emblemText.characters = 'C';
    emblemText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    emblem.appendChild(emblemText);
    logoFrame.appendChild(emblem);

    const textStack = figma.createFrame();
    textStack.name = 'Brand Names';
    textStack.fills = [];
    textStack.layoutMode = 'VERTICAL';
    textStack.itemSpacing = 2;
    
    const brandTitle = figma.createText();
    brandTitle.fontName = { family: 'Inter', style: 'Bold' };
    brandTitle.fontSize = 20;
    brandTitle.characters = 'Capi Demy';
    brandTitle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    textStack.appendChild(brandTitle);

    const brandSub = figma.createText();
    brandSub.fontName = { family: 'Inter', style: 'Bold' };
    brandSub.fontSize = 8;
    brandSub.characters = 'ĐÀO TẠO UI/UX DESIGN';
    brandSub.fills = [{ type: 'SOLID', color: TOKENS.colors.accent }];
    textStack.appendChild(brandSub);

    logoFrame.appendChild(textStack);
  }
  
  logoFrame.layoutAlign = 'STRETCH';
  parent.appendChild(logoFrame);
  return logoFrame;
}

// Component Library: 3. Styled Title Node
function createTitleComponent(
  parent: FrameNode,
  text: string,
  fontSize: number,
  alignment: 'left' | 'center',
  highlights?: string[],
  emphasis?: any[]
): TextNode {
  const textNode = figma.createText();
  textNode.name = 'Title';
  textNode.fontName = { family: 'Inter', style: 'Bold' };
  textNode.fontSize = fontSize;
  textNode.characters = text;
  textNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  textNode.layoutAlign = 'STRETCH';
  textNode.textAutoResize = 'HEIGHT';
  textNode.textAlignHorizontal = alignment === 'center' ? 'CENTER' : 'LEFT';
  textNode.lineHeight = { value: 130, unit: 'PERCENT' };

  const lowerText = text.toLowerCase();

  if (highlights && highlights.length > 0) {
    for (const hl of highlights) {
      if (!hl || hl.trim() === "") continue;
      let startIdx = 0;
      while (true) {
        const foundIdx = lowerText.indexOf(hl.toLowerCase(), startIdx);
        if (foundIdx === -1) break;
        const endIdx = foundIdx + hl.length;
        textNode.setRangeFills(foundIdx, endIdx, [{ type: 'SOLID', color: TOKENS.colors.accent }]);
        textNode.setRangeFontName(foundIdx, endIdx, { family: 'Inter', style: 'Bold' });
        startIdx = endIdx;
      }
    }
  }

  if (emphasis && emphasis.length > 0) {
    for (const emp of emphasis) {
      if (!emp.text || emp.text.trim() === "") continue;
      if (emp.importance === 'primary') {
        let startIdx = 0;
        while (true) {
          const foundIdx = lowerText.indexOf(emp.text.toLowerCase(), startIdx);
          if (foundIdx === -1) break;
          const endIdx = foundIdx + emp.text.length;
          textNode.setRangeFills(foundIdx, endIdx, [{ type: 'SOLID', color: TOKENS.colors.accent }]);
          textNode.setRangeFontName(foundIdx, endIdx, { family: 'Inter', style: 'Bold' });
          textNode.setRangeFontSize(foundIdx, endIdx, fontSize + 8);
          startIdx = endIdx;
        }
      }
    }
  }

  parent.appendChild(textNode);
  return textNode;
}

// Component Library: 4. Paragraph/Body Node
function createBodyComponent(
  parent: FrameNode,
  text: string,
  fontSize: number,
  alignment: 'left' | 'center'
): TextNode {
  const textNode = figma.createText();
  textNode.name = 'Body';
  textNode.fontName = { family: 'Inter', style: 'Regular' };
  textNode.fontSize = fontSize;
  textNode.characters = text;
  textNode.fills = [{ type: 'SOLID', color: TOKENS.colors.textMuted }];
  textNode.layoutAlign = 'STRETCH';
  textNode.textAutoResize = 'HEIGHT';
  textNode.textAlignHorizontal = alignment === 'center' ? 'CENTER' : 'LEFT';
  textNode.lineHeight = { value: 150, unit: 'PERCENT' };

  parent.appendChild(textNode);
  return textNode;
}

// Component Library: 5. Vertical Accent Sidebar
function createAccentBar(parent: FrameNode): FrameNode {
  const bar = figma.createFrame();
  bar.name = 'Left Accent Bar';
  bar.resize(6, 120);
  bar.cornerRadius = 3;
  bar.fills = [{ type: 'SOLID', color: TOKENS.colors.accent }];
  bar.layoutAlign = 'INHERIT';
  
  parent.appendChild(bar);
  return bar;
}

// Component Library: 6. Hero Image Card
async function createHeroImage(parent: FrameNode, imageBytes: Uint8Array, hasBorder: boolean): Promise<FrameNode> {
  const imgFrame = figma.createFrame();
  imgFrame.name = 'Hero Image';
  imgFrame.layoutAlign = 'STRETCH';
  imgFrame.resize(imgFrame.width, 380);
  imgFrame.cornerRadius = TOKENS.borderRadius;
  
  const image = figma.createImage(imageBytes);
  imgFrame.fills = [{
    type: 'IMAGE',
    scaleMode: 'FILL',
    imageHash: image.hash,
  }];
  
  if (hasBorder) {
    imgFrame.strokes = [{ type: 'SOLID', color: TOKENS.colors.accent }];
    imgFrame.strokeWeight = 3;
  }
  
  imgFrame.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 10 },
    radius: 20,
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }];

  parent.appendChild(imgFrame);
  return imgFrame;
}

// Component Library: 7. CTA Button Component
function createCtaButton(parent: FrameNode, text: string): FrameNode {
  const button = figma.createFrame();
  button.name = 'CTA Button';
  button.layoutMode = 'HORIZONTAL';
  button.primaryAxisAlignItems = 'CENTER';
  button.counterAxisAlignItems = 'CENTER';
  button.paddingTop = 18;
  button.paddingBottom = 18;
  button.paddingLeft = 36;
  button.paddingRight = 36;
  button.cornerRadius = 30;
  button.fills = [{ type: 'SOLID', color: TOKENS.colors.accent }];
  
  button.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 249 / 255, g: 178 / 255, b: 51 / 255, a: 0.3 },
    offset: { x: 0, y: 4 },
    radius: 12,
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }];

  const btnText = figma.createText();
  btnText.fontName = { family: 'Inter', style: 'Bold' };
  btnText.fontSize = 24;
  btnText.characters = text.toUpperCase();
  btnText.fills = [{ type: 'SOLID', color: TOKENS.colors.bg }];
  
  button.appendChild(btnText);
  parent.appendChild(button);
  return button;
}

// Component Library: 8. Stat Card
function createStatCard(parent: FrameNode, number: string, label: string): FrameNode {
  const card = figma.createFrame();
  card.name = 'Stat Card';
  card.layoutMode = 'VERTICAL';
  card.layoutAlign = 'STRETCH';
  card.primaryAxisAlignItems = 'CENTER';
  card.counterAxisAlignItems = 'CENTER';
  card.paddingTop = 32;
  card.paddingBottom = 32;
  card.paddingLeft = 24;
  card.paddingRight = 24;
  card.itemSpacing = 12;
  card.cornerRadius = TOKENS.borderRadius;
  card.fills = [{ type: 'SOLID', color: TOKENS.colors.cardBg }];
  
  const numNode = figma.createText();
  numNode.fontName = { family: 'Inter', style: 'Bold' };
  numNode.fontSize = 72;
  numNode.characters = number;
  numNode.fills = [{ type: 'SOLID', color: TOKENS.colors.accent }];
  card.appendChild(numNode);

  const lblNode = figma.createText();
  lblNode.fontName = { family: 'Inter', style: 'Regular' };
  lblNode.fontSize = 18;
  lblNode.characters = label;
  lblNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  lblNode.layoutAlign = 'STRETCH';
  lblNode.textAutoResize = 'HEIGHT';
  lblNode.textAlignHorizontal = 'CENTER';
  card.appendChild(lblNode);

  parent.appendChild(card);
  return card;
}

// Component Library: 9. Comparison Columns Block
function createComparisonCols(parent: FrameNode, comparisonData: any): FrameNode {
  const container = figma.createFrame();
  container.name = 'Comparison Columns';
  container.layoutMode = 'HORIZONTAL';
  container.layoutAlign = 'STRETCH';
  container.itemSpacing = 32;
  container.fills = [];
  
  const leftCol = figma.createFrame();
  leftCol.layoutMode = 'VERTICAL';
  leftCol.layoutAlign = 'STRETCH';
  leftCol.cornerRadius = TOKENS.borderRadius;
  leftCol.paddingTop = 32;
  leftCol.paddingBottom = 32;
  leftCol.paddingLeft = 32;
  leftCol.paddingRight = 32;
  leftCol.itemSpacing = 16;
  leftCol.fills = [{ type: 'SOLID', color: { r: 26 / 255, g: 10 / 255, b: 10 / 255 } }];
  leftCol.strokes = [{ type: 'SOLID', color: TOKENS.colors.red }];
  leftCol.strokeWeight = 1;
  container.appendChild(leftCol);

  const leftTitle = figma.createText();
  leftTitle.fontName = { family: 'Inter', style: 'Bold' };
  leftTitle.fontSize = 26;
  leftTitle.characters = comparisonData.leftTitle || 'SAI (✗)';
  leftTitle.fills = [{ type: 'SOLID', color: TOKENS.colors.red }];
  leftCol.appendChild(leftTitle);

  const leftItems = comparisonData.leftItems || [];
  for (const item of leftItems) {
    const itemText = figma.createText();
    itemText.fontName = { family: 'Inter', style: 'Regular' };
    itemText.fontSize = 20;
    itemText.characters = `✗ ${item}`;
    itemText.fills = [{ type: 'SOLID', color: TOKENS.colors.textMuted }];
    itemText.layoutAlign = 'STRETCH';
    itemText.textAutoResize = 'HEIGHT';
    leftCol.appendChild(itemText);
  }

  const rightCol = figma.createFrame();
  rightCol.layoutMode = 'VERTICAL';
  rightCol.layoutAlign = 'STRETCH';
  rightCol.cornerRadius = TOKENS.borderRadius;
  rightCol.paddingTop = 32;
  rightCol.paddingBottom = 32;
  rightCol.paddingLeft = 32;
  rightCol.paddingRight = 32;
  rightCol.itemSpacing = 16;
  rightCol.fills = [{ type: 'SOLID', color: TOKENS.colors.cardBg }];
  rightCol.strokes = [{ type: 'SOLID', color: TOKENS.colors.green }];
  rightCol.strokeWeight = 1.5;
  container.appendChild(rightCol);

  const rightTitle = figma.createText();
  rightTitle.fontName = { family: 'Inter', style: 'Bold' };
  rightTitle.fontSize = 26;
  rightTitle.characters = comparisonData.rightTitle || 'ĐÚNG (✓)';
  rightTitle.fills = [{ type: 'SOLID', color: TOKENS.colors.green }];
  rightCol.appendChild(rightTitle);

  const rightItems = comparisonData.rightItems || [];
  for (const item of rightItems) {
    const itemText = figma.createText();
    itemText.fontName = { family: 'Inter', style: 'Regular' };
    itemText.fontSize = 20;
    itemText.characters = `✓ ${item}`;
    itemText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    itemText.layoutAlign = 'STRETCH';
    itemText.textAutoResize = 'HEIGHT';
    rightCol.appendChild(itemText);
  }

  leftCol.layoutGrow = 1;
  rightCol.layoutGrow = 1;

  parent.appendChild(container);
  return container;
}

// Component Library: 10. Vertical Steps/Timeline Flow
function createTimelineSteps(parent: FrameNode, items: any[]): FrameNode {
  const container = figma.createFrame();
  container.name = 'Timeline Container';
  container.layoutMode = 'VERTICAL';
  container.layoutAlign = 'STRETCH';
  container.itemSpacing = 24;
  container.fills = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = figma.createFrame();
    row.name = `Timeline Step ${i + 1}`;
    row.layoutMode = 'HORIZONTAL';
    row.layoutAlign = 'STRETCH';
    row.itemSpacing = 20;
    row.primaryAxisAlignItems = 'MIN';
    row.counterAxisAlignItems = 'CENTER';
    row.fills = [];
    
    const circle = figma.createFrame();
    circle.name = 'Badge';
    circle.resize(48, 48);
    circle.cornerRadius = 24;
    circle.fills = [{ type: 'SOLID', color: TOKENS.colors.accent }];
    circle.layoutMode = 'HORIZONTAL';
    circle.primaryAxisAlignItems = 'CENTER';
    circle.counterAxisAlignItems = 'CENTER';
    
    const circleText = figma.createText();
    circleText.fontName = { family: 'Inter', style: 'Bold' };
    circleText.fontSize = 20;
    circleText.characters = String(i + 1);
    circleText.fills = [{ type: 'SOLID', color: TOKENS.colors.bg }];
    circle.appendChild(circleText);
    row.appendChild(circle);

    const content = figma.createFrame();
    content.name = 'Content';
    content.layoutMode = 'VERTICAL';
    content.layoutAlign = 'STRETCH';
    content.itemSpacing = 4;
    content.fills = [];
    content.layoutGrow = 1;
    
    const stepTitle = figma.createText();
    stepTitle.fontName = { family: 'Inter', style: 'Bold' };
    stepTitle.fontSize = 24;
    stepTitle.characters = item.title || `Bước ${i + 1}`;
    stepTitle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    stepTitle.layoutAlign = 'STRETCH';
    stepTitle.textAutoResize = 'HEIGHT';
    content.appendChild(stepTitle);

    if (item.description) {
      const stepDesc = figma.createText();
      stepDesc.fontName = { family: 'Inter', style: 'Regular' };
      stepDesc.fontSize = 18;
      stepDesc.characters = item.description;
      stepDesc.fills = [{ type: 'SOLID', color: TOKENS.colors.textMuted }];
      stepDesc.layoutAlign = 'STRETCH';
      stepDesc.textAutoResize = 'HEIGHT';
      content.appendChild(stepDesc);
    }
    
    row.appendChild(content);
    container.appendChild(row);
  }
  
  parent.appendChild(container);
  return container;
}

// Component Library: 11. Quote Block
function createQuoteBlock(parent: FrameNode, quoteData: any): FrameNode {
  const container = figma.createFrame();
  container.name = 'Quote Container';
  container.layoutMode = 'VERTICAL';
  container.layoutAlign = 'STRETCH';
  container.primaryAxisAlignItems = 'CENTER';
  container.counterAxisAlignItems = 'CENTER';
  container.itemSpacing = 20;
  container.fills = [];
  
  const quotes = figma.createText();
  quotes.fontName = { family: 'Inter', style: 'Bold' };
  quotes.fontSize = 96;
  quotes.characters = '“';
  quotes.fills = [{ type: 'SOLID', color: TOKENS.colors.accent }];
  quotes.textAlignHorizontal = 'CENTER';
  quotes.lineHeight = { value: 60, unit: 'PERCENT' };
  container.appendChild(quotes);

  const quoteText = figma.createText();
  quoteText.fontName = { family: 'Inter', style: 'Bold' };
  quoteText.fontSize = 32;
  quoteText.characters = quoteData.text || '';
  quoteText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  quoteText.textAlignHorizontal = 'CENTER';
  quoteText.layoutAlign = 'STRETCH';
  quoteText.textAutoResize = 'HEIGHT';
  quoteText.lineHeight = { value: 140, unit: 'PERCENT' };
  container.appendChild(quoteText);

  if (quoteData.author) {
    const authorText = figma.createText();
    authorText.fontName = { family: 'Inter', style: 'Regular' };
    authorText.fontSize = 20;
    authorText.characters = `— ${quoteData.author}`;
    authorText.fills = [{ type: 'SOLID', color: TOKENS.colors.textMuted }];
    authorText.textAlignHorizontal = 'CENTER';
    authorText.layoutAlign = 'STRETCH';
    authorText.textAutoResize = 'HEIGHT';
    container.appendChild(authorText);
  }

  parent.appendChild(container);
  return container;
}

// Component Library: 12. Smart Footer Node
function createFooter(parent: FrameNode, text: string, tips?: string, alignment: 'left' | 'center' = 'left'): FrameNode {
  const footerFrame = figma.createFrame();
  footerFrame.name = 'Footer';
  footerFrame.layoutMode = 'VERTICAL';
  footerFrame.layoutAlign = 'STRETCH';
  footerFrame.itemSpacing = 8;
  footerFrame.fills = [];
  
  if (tips) {
    const tipText = figma.createText();
    tipText.fontName = { family: 'Inter', style: 'Bold' };
    tipText.fontSize = 18;
    tipText.characters = tips;
    tipText.fills = [{ type: 'SOLID', color: TOKENS.colors.accent }];
    tipText.textAlignHorizontal = alignment === 'center' ? 'CENTER' : 'LEFT';
    tipText.layoutAlign = 'STRETCH';
    tipText.textAutoResize = 'HEIGHT';
    footerFrame.appendChild(tipText);
  } else if (text) {
    const footText = figma.createText();
    footText.fontName = { family: 'Inter', style: 'Regular' };
    footText.fontSize = 18;
    footText.characters = text;
    footText.fills = [{ type: 'SOLID', color: TOKENS.colors.textMuted }];
    footText.textAlignHorizontal = alignment === 'center' ? 'CENTER' : 'LEFT';
    footText.layoutAlign = 'STRETCH';
    footText.textAutoResize = 'HEIGHT';
    footerFrame.appendChild(footText);
  }

  parent.appendChild(footerFrame);
  return footerFrame;
}

// Slide Builder (Runner & Orchestrator using Layout Grammar)
export async function generateProgrammaticSlide(
  templateId: string,
  job: DesignJob,
  images: any[],
  bgBytes?: Uint8Array,
  logoBytes?: Uint8Array
): Promise<FrameNode> {
  const renderedPayload = job.renderedPayload as any;
  const { orderIndex } = job;
  
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Italic' });

  const slide = figma.createFrame();
  slide.name = `Slide_${orderIndex + 1}_${job.postId}`;
  slide.resize(TOKENS.canvasSize, TOKENS.canvasSize);
  
  if (bgBytes) {
    const bgImg = figma.createImage(bgBytes);
    slide.fills = [{
      type: 'IMAGE',
      scaleMode: 'FILL',
      imageHash: bgImg.hash,
    }];
  } else {
    slide.fills = [{ type: 'SOLID', color: TOKENS.colors.bg }];
  }
  
  slide.layoutMode = 'VERTICAL';
  slide.primaryAxisSizingMode = 'FIXED';
  slide.counterAxisSizingMode = 'FIXED';
  slide.paddingTop = TOKENS.padding;
  slide.paddingBottom = TOKENS.padding;
  slide.paddingLeft = TOKENS.padding;
  slide.paddingRight = TOKENS.padding;
  slide.itemSpacing = TOKENS.spacing;

  let titleVal = renderedPayload.title || '';
  let bodyVal = renderedPayload.body || '';
  let subtitleVal = renderedPayload.subtitle || '';
  let footerVal = renderedPayload.footer || 'medium.com/capi-demy';
  let numberVal = renderedPayload.number || `#${orderIndex + 1}`;
  let tipsVal = renderedPayload.tips || '';
  const highlights = renderedPayload.highlights || [];
  
  const designIntent = (renderedPayload.designIntent || {}) as any;
  const layoutPattern = designIntent.layoutPattern || 'left-number';
  const hero = designIntent.hero || {};
  const emphasis = designIntent.emphasis || [];
  
  const isMkt = renderedPayload.logoPosition === 'bottom-center';
  const logoPos = renderedPayload.logoPosition || 'top-center';

  const payloadKeys = Object.keys(renderedPayload);
  if (!titleVal) {
    const key = payloadKeys.find(k => k.toLowerCase().endsWith('slide_title') || k.toLowerCase().endsWith('title'));
    if (key) titleVal = (renderedPayload as any)[key];
  }
  if (!bodyVal) {
    const key = payloadKeys.find(
      k =>
        k.toLowerCase().endsWith('slide_description') ||
        k.toLowerCase().endsWith('body_content') ||
        k.toLowerCase().endsWith('body') ||
        k.toLowerCase().endsWith('description')
    );
    if (key) bodyVal = (renderedPayload as any)[key];
  }
  if (!subtitleVal) {
    const key = payloadKeys.find(k => k.toLowerCase().endsWith('subtitle'));
    if (key) subtitleVal = (renderedPayload as any)[key];
  }

  const lowerTemplate = templateId.toLowerCase();

  if (lowerTemplate.includes('cover')) {
    slide.primaryAxisAlignItems = 'CENTER';
    slide.counterAxisAlignItems = 'CENTER';

    if (logoPos === 'top-center') {
      createLogoComponent(slide, 'dark', 'top-center', logoBytes);
    }

    const contentStack = figma.createFrame();
    contentStack.name = 'Cover Content';
    contentStack.fills = [];
    contentStack.layoutMode = 'VERTICAL';
    contentStack.layoutAlign = 'STRETCH';
    contentStack.itemSpacing = 24;
    contentStack.primaryAxisAlignItems = 'CENTER';
    contentStack.counterAxisAlignItems = 'CENTER';
    slide.appendChild(contentStack);

    const titleNode = createTitleComponent(contentStack, titleVal, 64, 'center', highlights, emphasis);
    titleNode.textAlignHorizontal = 'CENTER';

    if (subtitleVal) {
      const subNode = createBodyComponent(contentStack, subtitleVal, 28, 'center');
      subNode.textAlignHorizontal = 'CENTER';
    }

    if (images && images.length > 0 && hero.type !== 'none') {
      await createHeroImage(contentStack, images[0].bytes, isMkt);
    }

    if (logoPos === 'bottom-center') {
      createLogoComponent(slide, 'dark', 'bottom-center', logoBytes);
    } else {
      createFooter(slide, footerVal, undefined, 'center');
    }

  } else if (lowerTemplate.includes('cta')) {
    slide.primaryAxisAlignItems = 'CENTER';
    slide.counterAxisAlignItems = 'CENTER';

    if (logoPos === 'top-center') {
      createLogoComponent(slide, 'dark', 'top-center', logoBytes);
    }

    const contentStack = figma.createFrame();
    contentStack.name = 'CTA Content';
    contentStack.fills = [];
    contentStack.layoutMode = 'VERTICAL';
    contentStack.layoutAlign = 'STRETCH';
    contentStack.itemSpacing = 32;
    contentStack.primaryAxisAlignItems = 'CENTER';
    contentStack.counterAxisAlignItems = 'CENTER';
    slide.appendChild(contentStack);

    createTitleComponent(contentStack, titleVal, 52, 'center', highlights, emphasis);

    if (subtitleVal) {
      createBodyComponent(contentStack, subtitleVal, 26, 'center');
    }

    if (images && images.length > 0) {
      await createHeroImage(contentStack, images[0].bytes, isMkt);
    }

    const btnText = bodyVal || 'ĐĂNG KÝ NGAY';
    createCtaButton(contentStack, btnText);

    if (logoPos === 'bottom-center') {
      createLogoComponent(slide, 'dark', 'bottom-center', logoBytes);
    } else {
      createFooter(slide, footerVal, undefined, 'center');
    }

  } else if (lowerTemplate.includes('comparison')) {
    createLogoComponent(slide, 'dark', 'top-center', logoBytes);
    createTitleComponent(slide, titleVal, 40, 'left', highlights, emphasis);

    const compData = renderedPayload.comparison || {
      leftTitle: 'SAI (✗)',
      rightTitle: 'ĐÚNG (✓)',
      leftItems: ['Lỗi thiết kế thường gặp...'],
      rightItems: ['Cách tiếp cận đúng đắn...']
    };
    createComparisonCols(slide, compData);
    createFooter(slide, footerVal, tipsVal, 'left');

  } else if (lowerTemplate.includes('statistics')) {
    createLogoComponent(slide, 'dark', 'top-center', logoBytes);
    createTitleComponent(slide, titleVal, 42, 'left', highlights, emphasis);

    const statsContainer = figma.createFrame();
    statsContainer.fills = [];
    statsContainer.layoutMode = 'HORIZONTAL';
    statsContainer.layoutAlign = 'STRETCH';
    statsContainer.itemSpacing = 40;
    statsContainer.primaryAxisAlignItems = 'CENTER';
    statsContainer.counterAxisAlignItems = 'CENTER';
    slide.appendChild(statsContainer);

    const statsData = renderedPayload.stats || [
      { number: '95%', label: 'Học viên đạt chất lượng đầu ra mong muốn' },
      { number: '2.5x', label: 'Tốc độ thăng tiến công việc trung bình' }
    ];

    for (const stat of statsData) {
      createStatCard(statsContainer, stat.number, stat.label);
    }
    createFooter(slide, footerVal, tipsVal, 'left');

  } else if (lowerTemplate.includes('timeline')) {
    createLogoComponent(slide, 'dark', 'top-center', logoBytes);
    createTitleComponent(slide, titleVal, 42, 'left', highlights, emphasis);

    const steps = renderedPayload.timelineItems || [
      { title: 'Bước 1: Nghiên cứu thói quen', description: 'Tìm hiểu hành vi và mong muốn cốt lõi của tệp khách hàng mục tiêu.' },
      { title: 'Bước 2: Xây dựng cấu trúc', description: 'Phác thảo các luồng trải nghiệm người dùng tối giản và trực quan nhất.' },
      { title: 'Bước 3: Hoàn thiện chi tiết', description: 'Thiết kế giao diện đẹp mắt đồng bộ theo đúng hướng dẫn thương hiệu.' }
    ];
    createTimelineSteps(slide, steps);
    createFooter(slide, footerVal, tipsVal, 'left');

  } else if (lowerTemplate.includes('quote')) {
    slide.primaryAxisAlignItems = 'CENTER';
    slide.counterAxisAlignItems = 'CENTER';

    createLogoComponent(slide, 'dark', 'top-center', logoBytes);

    const quoteData = renderedPayload.quote || {
      text: titleVal || '“Một thiết kế tốt là thiết kế giúp người dùng không cần phải suy nghĩ khi sử dụng.”',
      author: subtitleVal || 'Capi Demy Instructor'
    };
    createQuoteBlock(slide, quoteData);
    createFooter(slide, footerVal, tipsVal, 'center');

  } else {
    createLogoComponent(slide, 'dark', 'top-center', logoBytes);

    if (layoutPattern === 'split-horizontal') {
      const textStack = figma.createFrame();
      textStack.name = 'Text Stack';
      textStack.layoutMode = 'VERTICAL';
      textStack.layoutAlign = 'STRETCH';
      textStack.itemSpacing = 20;
      textStack.fills = [];
      slide.appendChild(textStack);

      createTitleComponent(textStack, titleVal, 42, 'left', highlights, emphasis);
      createBodyComponent(textStack, bodyVal, 24, 'left');

      if (images && images.length > 0) {
        await createHeroImage(slide, images[0].bytes, isMkt);
      }
    } else if (layoutPattern === 'split-vertical') {
      const cols = figma.createFrame();
      cols.name = 'Split Vertical Container';
      cols.layoutMode = 'HORIZONTAL';
      cols.layoutAlign = 'STRETCH';
      cols.itemSpacing = 40;
      cols.fills = [];
      cols.primaryAxisSizingMode = 'FIXED';
      cols.counterAxisSizingMode = 'AUTO';
      slide.appendChild(cols);

      const leftCol = figma.createFrame();
      leftCol.name = 'Left Column';
      leftCol.layoutMode = 'VERTICAL';
      leftCol.layoutAlign = 'INHERIT';
      leftCol.itemSpacing = 20;
      leftCol.fills = [];
      leftCol.layoutGrow = 1;
      leftCol.counterAxisSizingMode = 'FIXED';
      leftCol.primaryAxisSizingMode = 'AUTO';
      cols.appendChild(leftCol);

      createTitleComponent(leftCol, titleVal, 38, 'left', highlights, emphasis);
      createBodyComponent(leftCol, bodyVal, 22, 'left');

      if (images && images.length > 0) {
        const rightCol = figma.createFrame();
        rightCol.name = 'Right Column';
        rightCol.layoutMode = 'VERTICAL';
        rightCol.layoutAlign = 'INHERIT';
        rightCol.fills = [];
        rightCol.layoutGrow = 1;
        rightCol.counterAxisSizingMode = 'FIXED';
        rightCol.primaryAxisSizingMode = 'AUTO';
        cols.appendChild(rightCol);

        await createHeroImage(rightCol, images[0].bytes, isMkt);
      }
    } else {
      const rowContainer = figma.createFrame();
      rowContainer.name = 'Body Row Container';
      rowContainer.layoutMode = 'HORIZONTAL';
      rowContainer.layoutAlign = 'STRETCH';
      rowContainer.itemSpacing = 24;
      rowContainer.fills = [];
      rowContainer.primaryAxisSizingMode = 'FIXED';
      rowContainer.counterAxisSizingMode = 'AUTO';
      slide.appendChild(rowContainer);

      createAccentBar(rowContainer);

      const bodyStack = figma.createFrame();
      bodyStack.name = 'Content Stack';
      bodyStack.layoutMode = 'VERTICAL';
      bodyStack.layoutAlign = 'STRETCH';
      bodyStack.itemSpacing = 20;
      bodyStack.fills = [];
      bodyStack.layoutGrow = 1;
      bodyStack.counterAxisSizingMode = 'FIXED';
      bodyStack.primaryAxisSizingMode = 'AUTO';
      rowContainer.appendChild(bodyStack);

      const titleRow = figma.createFrame();
      titleRow.name = 'Title Header Row';
      titleRow.layoutMode = 'HORIZONTAL';
      titleRow.layoutAlign = 'STRETCH';
      titleRow.itemSpacing = 16;
      titleRow.counterAxisAlignItems = 'CENTER';
      titleRow.fills = [];
      titleRow.primaryAxisSizingMode = 'FIXED';
      titleRow.counterAxisSizingMode = 'AUTO';
      bodyStack.appendChild(titleRow);

      if (numberVal) {
        const numNode = figma.createText();
        numNode.fontName = { family: 'Inter', style: 'Bold' };
        numNode.fontSize = 42;
        numNode.characters = numberVal;
        numNode.fills = [{ type: 'SOLID', color: TOKENS.colors.accent }];
        titleRow.appendChild(numNode);
      }

      const titleNode = figma.createText();
      titleNode.fontName = { family: 'Inter', style: 'Bold' };
      titleNode.fontSize = 42;
      titleNode.characters = titleVal;
      titleNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      titleNode.layoutAlign = 'STRETCH';
      titleNode.textAutoResize = 'HEIGHT';
      titleNode.layoutGrow = 1;
      
      if (highlights && highlights.length > 0) {
        const lowerTitleText = titleVal.toLowerCase();
        for (const hl of highlights) {
          if (!hl || hl.trim() === "") continue;
          let startIdx = 0;
          while (true) {
            const foundIdx = lowerTitleText.indexOf(hl.toLowerCase(), startIdx);
            if (foundIdx === -1) break;
            const endIdx = foundIdx + hl.length;
            titleNode.setRangeFills(foundIdx, endIdx, [{ type: 'SOLID', color: TOKENS.colors.accent }]);
            startIdx = endIdx;
          }
        }
      }
      titleRow.appendChild(titleNode);

      createBodyComponent(bodyStack, bodyVal, 24, 'left');

      if (images && images.length > 0) {
        await createHeroImage(bodyStack, images[0].bytes, isMkt);
      }
    }

    createFooter(slide, footerVal, tipsVal, 'left');
  }

  const spacingOffset = 150;
  slide.x = orderIndex * (TOKENS.canvasSize + spacingOffset);
  slide.y = 0;
  
  figma.currentPage.appendChild(slide);
  return slide;
}
