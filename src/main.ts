import { connectPlugin, applyThemeTokens } from "@delta/ui/sdk/client";
import "./fonts";
import "./style.css";
import { icon } from "./icons";
import { youtube } from "./providers/youtube";
import { soundcloud } from "./providers/soundcloud";
import { spotify } from "./providers/spotify";
import { defaultSettings, type Settings, type SourceItem } from "./types";
const provider = { youtube, soundcloud, spotify }[__PROVIDER__];
const root = document.querySelector<HTMLDivElement>("#app")!;
const params = new URL(location.href).searchParams;
type Host = Awaited<ReturnType<typeof connectPlugin>>;
let host: Host | undefined;
if (parent !== window && params.get("embedded") === "1" && params.get("parentOrigin")) {
  try {
    host = await connectPlugin(params.get("parentOrigin")!);
    applyThemeTokens(host.context.tokens);
    host.onPresentation((c) => applyThemeTokens(c.tokens));
    addEventListener("pagehide", () => host?.close(), { once: true });
  } catch {
    host = undefined;
  }
}
const lang = (localStorage.getItem("delta-sources.language") || host?.context.language || navigator.language || "en").startsWith("ru") ? "ru" : "en";
document.documentElement.lang = lang;
if (!host?.context.tokens)
  document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const t = (ru: string, en: string) => (lang === "ru" ? ru : en);
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const KEY = "delta-sources." + provider.id;
function load<T>(name: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(KEY + "." + name) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
const save = (name: string, v: unknown) => localStorage.setItem(KEY + "." + name, JSON.stringify(v));
let settings: Settings = { ...defaultSettings, ...load<Partial<Settings>>("settings", {}) };
let recent: SourceItem[] = load<SourceItem[]>("recent", []).filter((i) => i && provider.parse(i.url)).slice(0, 50);
let results: SourceItem[] = [];
let status = "";
let busy = false;
let showSettings = false;
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
const time = (s?: number) => (!s ? "" : s >= 3600 ? `${Math.floor(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`);
function row(it: SourceItem, i: number, list: string) {
  return `<li class="item"><span class="art">${it.artwork ? `<img src="${esc(it.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : icon(provider.id)}</span><span class="meta"><strong>${esc(it.title)}</strong><small>${esc(it.artist || it.url.replace(/^https:\/\//, ""))}${it.duration ? " · " + time(it.duration) : ""}</small></span><button class="primary" data-act="play" data-list="${list}" data-i="${i}" title="${t("Играть сейчас", "Play now")}" aria-label="${t("Играть сейчас", "Play now")}">${icon("play")}</button><button data-act="enqueue" data-list="${list}" data-i="${i}" title="${t("В очередь", "Add to queue")}" aria-label="${t("В очередь", "Add to queue")}">${icon("plus")}</button></li>`;
}
function render() {
  const searchable = !!provider.search;
  root.innerHTML = `<header><span class="logo ${provider.id}">${icon(provider.id)}</span><h1>${provider.name}</h1><span class="grow"></span>${provider.id === "youtube" ? `<button data-act="settings" aria-pressed="${showSettings}" title="${t("Настройки", "Settings")}" aria-label="${t("Настройки", "Settings")}">${icon("gear")}</button>` : ""}</header>
<form id="q" role="search"><span class="field">${icon(searchable ? "search" : "link")}<input id="query" name="q" autocomplete="off" placeholder="${esc(searchable ? t("Поиск или ссылка", "Search or paste a link") : t("Вставьте ссылку", "Paste a link"))}" aria-label="${esc(searchable ? t("Поиск или ссылка", "Search or paste a link") : t("Ссылка", "Link"))}"></span><button class="primary" ${busy ? "disabled" : ""}>${searchable ? t("Найти", "Search") : t("Добавить", "Add")}</button><button type="button" data-act="external" title="${t("Искать на сайте", "Search on the site")}">${icon("out")}<span>${t("На сайте", "On site")}</span></button></form>
${showSettings ? `<section class="settings"><label>${t("Ключ YouTube Data API (необязательно)", "YouTube Data API key (optional)")}<input id="ytkey" type="password" autocomplete="off" value="${esc(settings.youtubeKey)}"></label><label>Piped API<textarea id="piped" rows="2">${esc(settings.pipedInstances.join("\n"))}</textarea></label><label>Invidious<textarea id="invidious" rows="2">${esc(settings.invidiousInstances.join("\n"))}</textarea></label><button data-act="save-settings" class="primary">${t("Сохранить", "Save")}</button></section>` : ""}
<p class="status" role="status" ${status ? "" : "hidden"}>${esc(status)}</p>
${results.length ? `<h2>${t("Результаты", "Results")}</h2><ul class="list">${results.map((r, i) => row(r, i, "results")).join("")}</ul>` : ""}
${recent.length ? `<h2>${icon("recent")} ${t("Недавние", "Recent")}</h2><ul class="list">${recent.map((r, i) => row(r, i, "recent")).join("")}</ul>` : ""}
${!results.length && !recent.length ? `<div class="empty">${icon(provider.id)}<p>${esc(provider.notes[lang])}</p></div>` : `<p class="note">${esc(provider.notes[lang])}</p>`}
${host ? "" : `<p class="note warn">${t("Откройте приложение внутри Delta, чтобы отправлять треки в плеер. Сейчас ссылки открываются в новой вкладке.", "Open this app inside Delta to send items to a player. Standalone, links open in a new tab.")}</p>`}`;
}
async function send(it: SourceItem, intent: "media.play" | "media.enqueue") {
  recent = [it, ...recent.filter((r) => r.url !== it.url)].slice(0, 50);
  save("recent", recent);
  if (!host) {
    window.open(it.url, "_blank", "noopener,noreferrer");
    render();
    return;
  }
  const r = await host.sendIntent(intent, { ...it, kind: it.kind });
  status =
    r === "forbidden"
      ? t("Delta не разрешила отправку: установите приложение «Медиа» (dev.delta.media).", "Delta refused: install a player that accepts media intents (Delta Media).")
      : intent === "media.play"
        ? t("Отправлено в плеер: ", "Sent to the player: ") + it.title
        : t("Добавлено в очередь: ", "Queued: ") + it.title;
  render();
}
root.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = (root.querySelector<HTMLInputElement>("#query")?.value || "").trim();
  if (!q) return;
  const direct = provider.parse(q);
  busy = true;
  status = t("Загрузка…", "Loading…");
  render();
  try {
    if (direct) {
      const it = provider.enrich ? await provider.enrich(direct) : direct;
      results = [it];
      status = "";
    } else if (provider.search) {
      results = await provider.search(q, settings);
      status = results.length ? "" : t("Ничего не найдено.", "Nothing found.");
    } else {
      results = [];
      status = t("Это не ссылка " + provider.name + ". Найдите трек на сайте и вставьте ссылку.", "Not a " + provider.name + " link. Find it on the site and paste the link.");
    }
  } catch (err) {
    results = [];
    status = t("Поиск недоступен: ", "Search unavailable: ") + (err as Error).message + t(". Вставьте ссылку или задайте ключ API в настройках.", ". Paste a link or set an API key in settings.");
  }
  busy = false;
  render();
});
root.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if (act === "play" || act === "enqueue") {
    const list = b.dataset.list === "recent" ? recent : results;
    const it = list[Number(b.dataset.i)];
    if (it) void send(it, act === "play" ? "media.play" : "media.enqueue");
  } else if (act === "external") {
    const q = (root.querySelector<HTMLInputElement>("#query")?.value || "").trim();
    window.open(provider.externalSearch(q), "_blank", "noopener,noreferrer");
  } else if (act === "settings") {
    showSettings = !showSettings;
    render();
  } else if (act === "save-settings") {
    const lines = (id: string) =>
      (root.querySelector<HTMLTextAreaElement>(id)?.value || "").split(/\s+/).filter((l) => l.startsWith("https://")).slice(0, 8);
    settings = { youtubeKey: (root.querySelector<HTMLInputElement>("#ytkey")?.value || "").trim().slice(0, 200), pipedInstances: lines("#piped"), invidiousInstances: lines("#invidious") };
    save("settings", settings);
    showSettings = false;
    status = t("Настройки сохранены.", "Settings saved.");
    render();
  }
});
render();
