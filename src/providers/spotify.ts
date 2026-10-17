import { clean, getJson, httpsUrl, type Provider, type SourceItem } from "../types";
const KIND = /^(track|album|playlist|episode|show|artist)$/;
const ID = /^[A-Za-z0-9]{10,40}$/;
export function spotifyRef(input: string): { kind: string; id: string } | undefined {
  const s = input.trim();
  const uri = s.match(/^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]{10,40})$/);
  if (uri) return { kind: uri[1], id: uri[2] };
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.hostname !== "open.spotify.com") return;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "embed") parts.shift();
    if (/^intl-/.test(parts[0] || "")) parts.shift();
    const [kind, id] = parts;
    return KIND.test(kind || "") && ID.test(id || "") ? { kind, id } : undefined;
  } catch {
    return;
  }
}
export const spotify: Provider = {
  id: "spotify",
  name: "Spotify",
  parse(input) {
    const r = spotifyRef(input);
    if (!r) return;
    return {
      provider: "spotify",
      kind: "audio",
      url: `https://open.spotify.com/${r.kind}/${r.id}`,
      title: "Spotify " + r.kind,
    };
  },
  async enrich(it: SourceItem, fetcher) {
    try {
      const j = await getJson("https://open.spotify.com/oembed?url=" + encodeURIComponent(it.url), fetcher, 5000);
      return { ...it, title: clean(j.title) || it.title, artwork: httpsUrl(j.thumbnail_url) || it.artwork };
    } catch {
      return it;
    }
  },
  externalSearch: (q) => "https://open.spotify.com/search/" + encodeURIComponent(q),
  notes: {
    en: "Spotify search requires a signed-in account (OAuth), which a sandboxed app cannot hold safely: search on open.spotify.com, use Share → Copy link and paste it here. The official embed plays 30-second previews unless you are signed in to Spotify in this browser/WebView.",
    ru: "Поиск в Spotify требует входа в аккаунт (OAuth), а изолированное приложение не может безопасно хранить его: найдите трек на open.spotify.com, «Поделиться → Скопировать ссылку» и вставьте сюда. Официальный плеер играет 30-секундные превью, если вы не вошли в Spotify в этом браузере/WebView.",
  },
};
