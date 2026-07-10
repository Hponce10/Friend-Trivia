import { NextRequest, NextResponse } from 'next/server';

// Deezer's public API needs no key but sends no CORS headers, so the
// browser can't call it directly — this route proxies search and track
// lookups. Track lookups return freshly signed preview URLs (they expire
// within minutes, so responses must never be cached).

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  const track = request.nextUrl.searchParams.get('track');

  try {
    if (track) {
      if (!/^\d+$/.test(track)) {
        return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });
      }
      const res = await fetch(`https://api.deezer.com/track/${track}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.error || !data.preview) {
        return NextResponse.json({ error: 'Track unavailable' }, { status: 404 });
      }
      return NextResponse.json(
        { preview: data.preview },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (q) {
      const res = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=8`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      type DeezerTrack = {
        id: number;
        title: string;
        preview: string;
        artist: { name: string };
        album: { cover_small: string };
      };
      const tracks = ((data.data ?? []) as DeezerTrack[])
        .filter((t) => t.preview)
        .map((t) => ({
          trackId: t.id,
          title: t.title,
          artist: t.artist.name,
          cover: t.album.cover_small,
          preview: t.preview,
        }));
      return NextResponse.json(
        { tracks },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json({ error: 'Missing q or track param' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Deezer unreachable' }, { status: 502 });
  }
}
