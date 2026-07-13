import { Game, Player } from './types';
import { hueFor } from '@/components/Avatar';

// Renders the end-of-game recap as a PNG (1080×1350, the 4:5 portrait that
// chat apps preview at full size) and hands it to the OS share sheet, or
// downloads it where the Web Share API can't take files. Pure client-side —
// canvas only, no server round-trip.

const W = 1080;
const H = 1350;

// Podium display order and block heights mirror ResultsScreen: 2nd, 1st, 3rd.
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHTS = [190, 260, 140];
const PODIUM_MEDALS = ['🥈', '🥇', '🥉'];

function displayFont(px: number): string {
  // next/font exposes the real (hashed) Anton family via this CSS variable;
  // the font is already loaded on the page, so canvas can use it directly.
  const anton = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-anton')
    .trim();
  return `${px}px ${anton || 'sans-serif'}`;
}

function sansFont(px: number, weight = 400): string {
  const geist = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-geist-sans')
    .trim();
  return `${weight} ${px}px ${geist || 'system-ui, sans-serif'}`;
}

function loadPhoto(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Shrink a font until the text fits maxWidth (floor 60% of the start size). */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (px: number) => string,
  startPx: number,
  maxWidth: number
): void {
  let px = startPx;
  ctx.font = font(px);
  while (ctx.measureText(text).width > maxWidth && px > startPx * 0.6) {
    px -= 4;
    ctx.font = font(px);
  }
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  player: Player,
  photo: HTMLImageElement | null,
  cx: number,
  cy: number,
  r: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (photo) {
    // object-fit: cover
    const scale = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = `hsl(${hueFor(player.name)} 55% 45%)`;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const initials = player.name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = displayFont(r * 0.8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, cx, cy + r * 0.06);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 4;
  ctx.stroke();
}

async function renderRecap(game: Game, players: Player[]): Promise<Blob> {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const rest = sorted.slice(3);

  const photos = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    sorted.slice(0, 3).map(async (p) => {
      photos.set(p.id, p.photo ? await loadPhoto(p.photo) : null);
    })
  );

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');

  // Background — the stage's deep-navy gradient with a soft amber glow
  // behind the crown so the image doesn't read as a flat screenshot.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#11103a');
  bg.addColorStop(1, '#070618');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 330, 60, W / 2, 330, 560);
  glow.addColorStop(0, 'rgba(246,196,83,0.18)');
  glow.addColorStop(1, 'rgba(246,196,83,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Header
  const date = new Date(game.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  ctx.fillStyle = '#818cf8';
  ctx.font = sansFont(30, 600);
  ctx.fillText(`F I N A L   S T A N D I N G S   ·   ${date}`.toUpperCase(), W / 2, 96);

  ctx.font = displayFont(88);
  const friend = 'FRIEND ';
  const trivia = 'TRIVIA';
  const total = ctx.measureText(friend + trivia).width;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(friend, W / 2 - total / 2, 196);
  ctx.fillStyle = '#f6c453';
  ctx.fillText(trivia, W / 2 - total / 2 + ctx.measureText(friend).width, 196);
  ctx.textAlign = 'center';

  // Winner
  if (winner) {
    ctx.font = '72px sans-serif';
    ctx.fillText('👑', W / 2, 320);
    ctx.fillStyle = '#f6c453';
    ctx.shadowColor = 'rgba(246,196,83,0.45)';
    ctx.shadowBlur = 40;
    fitText(ctx, winner.name.toUpperCase(), displayFont, 96, W - 120);
    ctx.fillText(winner.name.toUpperCase(), W / 2, 430);
    ctx.shadowBlur = 0;
  }

  // Podium — columns at 2nd, 1st, 3rd, blocks sharing a baseline. The 1st
  // column's medal (topY − 200) must clear the winner name baseline at 430.
  const colW = 250;
  const gap = 28;
  const baseline = 950;
  const startX = W / 2 - (colW * 3 + gap * 2) / 2;
  PODIUM_ORDER.forEach((rank, i) => {
    const p = sorted[rank];
    if (!p) return;
    const x = startX + i * (colW + gap);
    const blockH = PODIUM_HEIGHTS[i];
    const topY = baseline - blockH;

    // block
    const grad = ctx.createLinearGradient(0, topY, 0, baseline);
    if (rank === 0) {
      grad.addColorStop(0, '#fcd34d');
      grad.addColorStop(1, '#f59e0b');
    } else {
      grad.addColorStop(0, '#4338ca');
      grad.addColorStop(1, '#3730a3');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, topY, colW, blockH, [18, 18, 0, 0]);
    ctx.fill();

    ctx.fillStyle = rank === 0 ? '#1e1b4b' : '#f6c453';
    ctx.font = displayFont(46);
    ctx.fillText(String(p.score), x + colW / 2, topY + 62);

    // medal, avatar, name above the block
    ctx.font = '44px sans-serif';
    ctx.fillText(PODIUM_MEDALS[i], x + colW / 2, topY - 200);
    drawAvatar(ctx, p, photos.get(p.id) ?? null, x + colW / 2, topY - 122, 58);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    fitText(ctx, p.name, (px) => sansFont(px, 600), 34, colW - 16);
    ctx.fillText(p.name, x + colW / 2, topY - 24);
  });

  // Everyone else — up to five rows, then a "+N more" line.
  const shown = rest.slice(0, 5);
  shown.forEach((p, i) => {
    const y = 986 + i * 52;
    ctx.fillStyle = 'rgba(49,46,129,0.55)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 380, y, 760, 44, 12);
    ctx.fill();
    ctx.fillStyle = '#818cf8';
    ctx.font = displayFont(26);
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 4), W / 2 - 344, y + 32);
    ctx.fillStyle = '#e0e7ff';
    ctx.font = sansFont(26, 500);
    ctx.fillText(p.name, W / 2 - 290, y + 32);
    ctx.textAlign = 'right';
    ctx.fillStyle = p.score < 0 ? '#f87171' : '#c7d2fe';
    ctx.fillText(String(p.score), W / 2 + 344, y + 32);
    ctx.textAlign = 'center';
  });
  if (rest.length > 5) {
    ctx.fillStyle = '#6366f1';
    ctx.font = sansFont(24, 500);
    ctx.fillText(`+${rest.length - 5} more`, W / 2, 986 + 5 * 52 + 30);
  }

  // Footer
  ctx.fillStyle = '#6366f1';
  ctx.font = sansFont(28, 600);
  ctx.fillText(`ROOM ${game.roomCode}  ·  ${sorted.length} PLAYERS`, W / 2, H - 56);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    );
  });
}

/** Render the recap and open the OS share sheet (mobile) or download the
    PNG (desktop). Returns 'shared' | 'downloaded', throws on render failure;
    a user-cancelled share sheet still counts as 'shared'. */
export async function shareRecap(
  game: Game,
  players: Player[]
): Promise<'shared' | 'downloaded'> {
  const blob = await renderRecap(game, players);
  const file = new File([blob], `friend-trivia-${game.roomCode}.png`, {
    type: 'image/png',
  });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Friend Trivia results' });
    } catch (e) {
      // AbortError = user closed the sheet; anything else falls back to download
      if ((e as DOMException).name === 'AbortError') return 'shared';
      downloadBlob(blob, file.name);
      return 'downloaded';
    }
    return 'shared';
  }
  downloadBlob(blob, file.name);
  return 'downloaded';
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
