import Phaser from 'phaser';

/** Rounded, playful font used for every "gracias" (bundled with @fontsource/chewy). */
export const FONT_CUTE = 'Chewy, "Comic Sans MS", "Chalkboard SE", cursive';

const RAINBOW = ['#ff5f8f', '#ff9b4a', '#ffd84a', '#6fe07f', '#4cc6ff', '#a98bff', '#ff7fd8'];
const CUTE_RE = /gracias/i;

/** Paints a text with a horizontal rainbow (recomputed for its current width). */
export function rainbow(t: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  const w = Math.max(1, t.width);
  const g = t.context.createLinearGradient(0, 0, w, 0);
  RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
  t.setFill(g as unknown as string);
  return t;
}

/** Turns a text object into a "gracias" one: cute font, rainbow, soft outline. */
export function cutify(t: Phaser.GameObjects.Text, size?: number): Phaser.GameObjects.Text {
  t.setFontFamily(FONT_CUTE).setFontStyle('normal').setStroke('#3a1452', Math.max(4, Math.round((size ?? 30) / 7)));
  if (size) t.setFontSize(size);
  return rainbow(t);
}

export interface RichStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  fontStyle?: string;
  /** Wrap width (0 = single line). */
  width?: number;
  align?: 'left' | 'center';
  lineSpacing?: number;
  /** Size multiplier for the cute words. */
  cuteScale?: number;
  shadow?: boolean;
}

interface Seg {
  t: Phaser.GameObjects.Text;
  text: string;
  start: number;
  cute: boolean;
  shown: number;
}

/**
 * A text that lays out word by word so that every "gracias" can wear its own
 * font and colours. Supports wrapping, centring and a typewriter reveal.
 */
export class RichText {
  readonly container: Phaser.GameObjects.Container;
  private segs: Seg[] = [];
  private text = '';
  height = 0;
  width = 0;

  constructor(private scene: Phaser.Scene, x: number, y: number, private style: RichStyle) {
    this.container = scene.add.container(x, y);
  }

  get length(): number {
    return this.text.length;
  }

  setText(text: string): this {
    this.text = text;
    this.segs.forEach((s) => s.t.destroy());
    this.segs = [];
    const st = this.style;
    const size = st.fontSize;
    const cuteSize = Math.round(size * (st.cuteScale ?? 1.15));
    const lineH = Math.round(size * 1.3) + (st.lineSpacing ?? 4);
    const maxW = st.width ?? 0;
    const base = (cute: boolean): Phaser.Types.GameObjects.Text.TextStyle => cute
      ? { fontFamily: FONT_CUTE, fontSize: `${cuteSize}px`, color: '#ffffff', stroke: '#3a1452', strokeThickness: Math.max(4, Math.round(cuteSize / 7)) }
      : { fontFamily: st.fontFamily, fontSize: `${size}px`, color: st.color, fontStyle: st.fontStyle ?? 'normal' };
    const space = this.scene.add.text(0, 0, ' ', base(false));
    const spaceW = space.width;
    space.destroy();

    const lines: Seg[][] = [[]];
    const lineWidths = [0];
    let x = 0;
    let pos = 0;
    for (const tok of text.split(/(\s+)/)) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) {
        if (tok.includes('\n')) {
          lines.push([]);
          lineWidths.push(0);
          x = 0;
        } else if (x > 0) x += spaceW * tok.length;
        pos += tok.length;
        continue;
      }
      const cute = CUTE_RE.test(tok);
      const t = this.scene.add.text(0, 0, tok, base(cute)).setOrigin(0, 0.5);
      if (st.shadow) t.setShadow(0, 2, 'rgba(0,10,30,0.85)', 6, true, true);
      if (maxW && x > 0 && x + t.width > maxW) {
        lines.push([]);
        lineWidths.push(0);
        x = 0;
      }
      t.setX(x);
      const seg: Seg = { t, text: tok, start: pos, cute, shown: tok.length };
      if (cute) rainbow(t);
      lines[lines.length - 1].push(seg);
      x += t.width;
      lineWidths[lineWidths.length - 1] = x;
      this.segs.push(seg);
      this.container.add(t);
      pos += tok.length;
    }
    this.width = Math.max(...lineWidths);
    this.height = lines.length * lineH;
    lines.forEach((line, i) => {
      const dx = st.align === 'center' ? -lineWidths[i] / 2 : 0;
      const y = i * lineH + lineH / 2 - (st.align === 'center' ? this.height / 2 : 0);
      line.forEach((s) => s.t.setPosition(s.t.x + dx, y));
    });
    return this;
  }

  /** Typewriter: show only the first `n` characters. */
  reveal(n: number): void {
    for (const s of this.segs) {
      const k = Phaser.Math.Clamp(n - s.start, 0, s.text.length);
      if (k === s.shown) continue;
      s.shown = k;
      s.t.setText(s.text.slice(0, k));
      if (s.cute && k > 0) rainbow(s.t);
    }
  }

  setAlpha(a: number): this {
    this.container.setAlpha(a);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }
}

/** One centred line (or a wrapped block) of text with colourful "gracias". */
export function richLine(scene: Phaser.Scene, x: number, y: number, text: string, style: RichStyle): RichText {
  return new RichText(scene, x, y, { align: 'center', shadow: true, ...style }).setText(text);
}
