// 紙(DOM)を、見た目そのままにcanvasへ写し取る。WebGLで燃やすための元画像にする。
// 文字は1文字ずつDOM上の位置を測って同じ場所へ描くので、改行や字詰めがDOMと一致する。

export interface PaperSnapshot {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
}

function cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// CSSの linear-gradient(angle, ...) と同じ向き・長さのグラデーションを作る。
function linearGradient(ctx: CanvasRenderingContext2D, width: number, height: number, angleDeg: number) {
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
    const cx = width / 2;
    const cy = height / 2;
    return ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
}

// 内側の影(inset box-shadow)。紙の外側を塗った図形の影だけを、紙の内側に落とす。
function drawInsetShadow(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(-200, -200, width + 400, height + 400);
    ctx.rect(0, 0, width, height);
    ctx.shadowColor = 'rgba(150, 130, 90, 0.22)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#000';
    ctx.fill('evenodd');
    ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, card: HTMLElement, scale: number) {
    const cardRect = card.getBoundingClientRect();
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        const text = node.textContent ?? '';
        if (!parent || !text.trim()) continue;
        const style = getComputedStyle(parent);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textBaseline = 'alphabetic';
        const metrics = ctx.measureText('永');
        const ascent = metrics.fontBoundingBoxAscent;
        const glyphHeight = ascent + metrics.fontBoundingBoxDescent;

        for (let i = 0; i < text.length; i += 1) {
            const char = text[i]!;
            if (!char.trim()) continue;
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0) continue;
            const x = (rect.left - cardRect.left) / scale;
            const top = (rect.top - cardRect.top) / scale;
            const height = rect.height / scale;
            ctx.fillText(char, x, top + (height - glyphHeight) / 2 + ascent);
        }
    }
}

// 文字以外で見た目を持つ要素(罫線など)を、背景色の矩形として描く。
function drawRules(ctx: CanvasRenderingContext2D, card: HTMLElement, scale: number, selector: string) {
    const cardRect = card.getBoundingClientRect();
    for (const el of card.querySelectorAll<HTMLElement>(selector)) {
        const rect = el.getBoundingClientRect();
        ctx.fillStyle = getComputedStyle(el).backgroundColor;
        ctx.fillRect(
            (rect.left - cardRect.left) / scale,
            (rect.top - cardRect.top) / scale,
            rect.width / scale,
            rect.height / scale,
        );
    }
}

export async function capturePaper(card: HTMLElement, ruleSelector: string, pixelRatio: number): Promise<PaperSnapshot> {
    // 明朝体の読み込み前に描くと代替フォントで写ってしまう。
    await document.fonts.ready;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    // 傾きや拡縮が掛かっていても、紙そのものの座標系で写し取る。
    const scale = card.getBoundingClientRect().width / width || 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { canvas, width, height };
    ctx.scale(pixelRatio, pixelRatio);

    const gradient = linearGradient(ctx, width, height, 170);
    gradient.addColorStop(0, cssVar('--rr-paper'));
    gradient.addColorStop(1, cssVar('--rr-paper-dark'));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    drawInsetShadow(ctx, width, height);
    drawRules(ctx, card, scale, ruleSelector);
    drawText(ctx, card, scale);

    return { canvas, width, height };
}
