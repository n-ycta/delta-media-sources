import { clean, getJson, httpsUrl, type Provider, type SourceItem } from "../types";
export function soundcloudUrl(input: string): string | undefined {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "https:") return;
    const host = u.hostname.replace(/^(www|m)\./, "");
    if (host === "w.soundcloud.com") return soundcloudUrl(u.searchParams.get("url") || "");
    if (host === "on.soundcloud.com" && /^\/[A-Za-z0-9]+$/.test(u.pathname)) return u.origin + u.pathname;
    if (host !== "soundcloud.com" && host !== "api.soundcloud.com") return;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || parts.some((p) => !/^[A-Za-z0-9_.-]+$/.test(p))) return;
    if (["discover", "search", "you", "stream", "upload"].includes(parts[0])) return;
    return `https://${host === "api.soundcloud.com" ? "api." : ""}soundcloud.com/` + parts.join("/");
  } catch {
    return;
  }
}
export const soundcloud: Provider = {
  id: "soundcloud",
  name: "SoundCloud",
  parse(input) {
    const url = soundcloudUrl(input);
    if (!url) return;
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const pretty = (s = "") => s.replace(/[-_]+/g, " ");
    return { provider: "soundcloud", kind: "audio", url, title: pretty(parts[1]) || "SoundCloud", artist: pretty(parts[0]) || undefined };
  },
  async enrich(it: SourceItem, fetcher) {
    try {
      const j = await getJson("https://soundcloud.com/oembed?format=json&url=" + encodeURIComponent(it.url), fetcher, 5000);
      return { ...it, title: clean(j.title) || it.title, artist: clean(j.author_name) || it.artist, artwork: httpsUrl(j.thumbnail_url) || it.artwork };
    } catch {
      return it;
    }
  },
  externalSearch: (q) => "https://soundcloud.com/search/sounds?q=" + encodeURIComponent(q),
  notes: {
    en: "SoundCloud no longer issues public API keys, so in-app search is not available: search on soundcloud.com, copy the track/playlist link and paste it here. Playback uses the official SoundCloud widget.",
    ru: "SoundCloud больше не выдаёт публичные API-ключи, поэтому поиска внутри приложения нет: найдите трек на soundcloud.com, скопируйте ссылку и вставьте сюда. Воспроизведение — официальный виджет SoundCloud.",
  },
};
