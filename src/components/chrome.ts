import { LayoutContext } from '../core/context';
import { DECORATION } from '../tokens';

// ─── Logo ─────────────────────────────────────────────────────────────────────

export async function createLogo(
  parent: FrameNode,
  context: LayoutContext,
): Promise<FrameNode> {
  const { theme, assets } = context;

  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  const logoPosition = context.logoPosition || 'top-center';
  const logoFrame = figma.createFrame();
  logoFrame.name = 'Brand Logo';
  logoFrame.layoutMode = 'HORIZONTAL';
  logoFrame.primaryAxisAlignItems = 'CENTER';
  logoFrame.counterAxisAlignItems = 'CENTER';
  logoFrame.itemSpacing = 12;
  logoFrame.fills = [];
  logoFrame.layoutAlign = 'STRETCH';

  if (assets.logo) {
    const logoNode = figma.createFrame();
    logoNode.name = 'Logo Image';
    logoNode.resize(200, 75);
    const img = figma.createImage(assets.logo);
    logoNode.fills = [{ type: 'IMAGE', scaleMode: 'FIT', imageHash: img.hash }];
    logoFrame.appendChild(logoNode);
  } else {
    // Text fallback
    const emblem = figma.createFrame();
    emblem.name = 'Emblem';
    emblem.resize(36, 36);
    emblem.cornerRadius = 8;
    emblem.fills = [{ type: 'SOLID', color: theme.highlight }];
    emblem.layoutMode = 'HORIZONTAL';
    emblem.primaryAxisAlignItems = 'CENTER';
    emblem.counterAxisAlignItems = 'CENTER';

    const eText = figma.createText();
    eText.fontName = { family: 'Inter', style: 'Bold' };
    eText.fontSize = 18;
    eText.characters = 'C';
    eText.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    emblem.appendChild(eText);
    logoFrame.appendChild(emblem);

    const brandName = figma.createText();
    brandName.fontName = { family: 'Inter', style: 'Bold' };
    brandName.fontSize = 18;
    brandName.characters = 'Capi Demy';
    brandName.fills = [{ type: 'SOLID', color: theme.textPrimary }];
    logoFrame.appendChild(brandName);
  }

  parent.appendChild(logoFrame);
  return logoFrame;
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export async function createFooter(
  parent: FrameNode,
  context: LayoutContext,
  text: string = 'capidemy.com',
): Promise<TextNode> {
  const { theme } = context;

  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const footerText = figma.createText();
  footerText.name = 'Footer';
  footerText.fontName = { family: 'Inter', style: 'Regular' };
  footerText.fontSize = 18;
  footerText.characters = text;
  footerText.fills = [{ type: 'SOLID', color: theme.textMuted }];
  footerText.layoutAlign = 'STRETCH';
  footerText.textAutoResize = 'HEIGHT';

  parent.appendChild(footerText);
  return footerText;
}

// ─── Ambient Orbs Decorator ───────────────────────────────────────────────────

export function addAmbientOrbs(_slide: FrameNode, _context: LayoutContext): void {
  // Đã gỡ bỏ: Ảnh background thiết kế đã có sẵn hiệu ứng blur orb.
}
