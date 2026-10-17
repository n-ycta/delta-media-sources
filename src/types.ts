/** One playable thing handed to a player through `media.play` / `media.enqueue`. */
export interface SourceItem {
  provider: "youtube" | "soundcloud" | "spotify";
  url: string;
  title: string;
  artist?: string;
  channelUrl?: string;
  artwork?: string;
  duration?: number;
  kind: "audio" | "video";
}
export interface Provider {
  id: SourceItem["provider"];
  name: string;
  /** Turns a pasted page/share link into a canonical item, or undefined if it is not ours. */
  parse(input: string): SourceItem | undefined;
  /** Optional metadata enrichment (oEmbed); must never be required for playback. */
  enrich?(item: SourceItem, fetcher?: typeof fetch): Promise<SourceItem>;
  /** In-app search, when an API is reachable without account credentials. */
  search?(query: string, settings: Settings, fetcher?: typeof fetch): Promise<SourceItem[]>;
  /** Fallback: search on the provider's own site in a new tab. */
  externalSearch(query: string): string;
  notes: { en: string; ru: string };
}
export interface Settings {
  youtubeKey: string;
  pipedInstances: string[];
  invidiousInstances: string[];
}
export const defaultSettings: Settings = {
  youtubeKey: "",
  pipedInstances: ["https://api.piped.private.coffee", "https://pipedapi.kavin.rocks"],
  invidiousInstances: ["https://invidious.f5.si", "https://inv.nadeko.net"],
};
const ctl = /[\u0000-\u001f\u007f]/g;
export const clean = (v: unknown, max = 300) =>
  typeof v === "string" ? v.replace(ctl, " ").trim().slice(0, max) : "";
export function httpsUrl(v: unknown): string | undefined {
  try {
    const u = new URL(clean(v, 2048));
    return u.protocol === "https:" && !u.username && !u.password ? u.href : undefined;
  } catch {
    return undefined;
  }
}
/** Small JSON GET with timeout and size limit. */
export async function getJson(url: string, fetcher: typeof fetch = fetch, ms = 8000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetcher(url, { signal: ctrl.signal, referrerPolicy: "no-referrer", credentials: "omit" });
    if (!r.ok) throw Error("http_" + r.status);
    const text = await r.text();
    if (text.length > 2_000_000) throw Error("too_large");
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}
