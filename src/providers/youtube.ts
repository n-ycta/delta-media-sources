import { clean, getJson, httpsUrl, type Provider, type Settings, type SourceItem } from "../types";
const ID = /^[A-Za-z0-9_-]{11}$/;
export function youtubeId(input: string): string | undefined {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return ID.test(input.trim()) ? input.trim() : undefined;
  }
  if (u.protocol !== "https:") return;
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/);
    id = m ? m[1] : u.searchParams.get("v") || "";
  }
  return ID.test(id) ? id : undefined;
}
const item = (id: string, title: string, artist?: string, duration?: number): SourceItem => ({
  provider: "youtube",
  kind: "video",
  url: "https://www.youtube.com/watch?v=" + id,
  title: clean(title) || "YouTube " + id,
  artist: clean(artist) || undefined,
  artwork: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  duration: typeof duration === "number" && duration > 0 && duration < 1e6 ? duration : undefined,
});
/** Official Data API v3 (user's own key). */
export function fromDataApi(json: any): SourceItem[] {
  return (Array.isArray(json?.items) ? json.items : []).flatMap((v: any) => {
    const id = v?.id?.videoId;
    return ID.test(id || "") ? [item(id, v.snippet?.title, v.snippet?.channelTitle)] : [];
  });
}
/** Piped API `/search?filter=videos`. */
export function fromPiped(json: any): SourceItem[] {
  return (Array.isArray(json?.items) ? json.items : []).flatMap((v: any) => {
    const id = typeof v?.url === "string" ? new URLSearchParams(v.url.split("?")[1] || "").get("v") || "" : "";
    return v?.type === "stream" && ID.test(id) ? [item(id, v.title, v.uploaderName, v.duration)] : [];
  });
}
/** Invidious API `/api/v1/search?type=video`. */
export function fromInvidious(json: any): SourceItem[] {
  return (Array.isArray(json) ? json : []).flatMap((v: any) =>
    v?.type === "video" && ID.test(v.videoId || "") ? [item(v.videoId, v.title, v.author, v.lengthSeconds)] : [],
  );
}
const decodeHtml = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e as "amp"]);
export const youtube: Provider = {
  id: "youtube",
  name: "YouTube",
  parse(input) {
    const id = youtubeId(input);
    return id ? item(id, "") : undefined;
  },
  async enrich(it, fetcher) {
    try {
      const j = await getJson("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(it.url), fetcher, 5000);
      return { ...it, title: decodeHtml(clean(j.title)) || it.title, artist: clean(j.author_name) || it.artist };
    } catch {
      return it;
    }
  },
  async search(query, settings: Settings, fetcher) {
    const q = encodeURIComponent(query.trim().slice(0, 200));
    if (settings.youtubeKey.trim()) {
      try {
        return fromDataApi(await getJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&q=${q}&key=${encodeURIComponent(settings.youtubeKey.trim())}`, fetcher, 1500));
      } catch { /* The configured API failed; public services may still work. */ }
    }
    const candidates = [
      ...settings.pipedInstances.map(httpsUrl).filter(Boolean).map(base=>({url:base!.replace(/\/$/, "")+`/search?filter=videos&q=${q}`,parse:fromPiped})),
      ...settings.invidiousInstances.map(httpsUrl).filter(Boolean).map(base=>({url:base!.replace(/\/$/, "")+`/api/v1/search?type=video&q=${q}`,parse:fromInvidious})),
    ];
    let empty = false;
    try {
      return await Promise.any(candidates.map(async c => {
        const rows = c.parse(await getJson(c.url,fetcher,2200));
        if (!rows.length) { empty = true; throw Error('no_results'); }
        return rows;
      }));
    } catch {
      if (empty) return [];
      throw Error('search_unavailable');
    }
  },
  externalSearch: (q) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q),
  notes: {
    en: "Search uses your own YouTube Data API key if set, otherwise public Piped/Invidious instances (availability varies). Playback uses the official youtube-nocookie embed.",
    ru: "Поиск идёт через ваш ключ YouTube Data API, если он задан, иначе через публичные Piped/Invidious (доступность меняется). Воспроизведение — официальный плеер youtube-nocookie.",
  },
};
