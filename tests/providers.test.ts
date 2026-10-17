import { test } from "node:test";
import assert from "node:assert/strict";
import { youtube, youtubeId, fromPiped, fromInvidious, fromDataApi } from "../src/providers/youtube";
import { soundcloud, soundcloudUrl } from "../src/providers/soundcloud";
import { spotify, spotifyRef } from "../src/providers/spotify";
import { defaultSettings } from "../src/types";
test("YouTube links and ids", () => {
  for (const u of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "dQw4w9WgXcQ",
  ])
    assert.equal(youtubeId(u), "dQw4w9WgXcQ", u);
  for (const u of ["http://youtu.be/dQw4w9WgXcQ", "https://evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=short", "cats"])
    assert.equal(youtubeId(u), undefined, u);
  assert.equal(youtube.parse("https://youtu.be/dQw4w9WgXcQ")?.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});
test("YouTube search response mapping", () => {
  assert.equal(fromPiped({ items: [{ type: "stream", url: "/watch?v=dQw4w9WgXcQ", title: "A", uploaderName: "B", duration: 212 }, { type: "channel", url: "/channel/x" }] }).length, 1);
  assert.equal(fromInvidious([{ type: "video", videoId: "dQw4w9WgXcQ", title: "A", author: "B", lengthSeconds: 1 }, { type: "video", videoId: "<script>" }])[0].artist, "B");
  assert.equal(fromDataApi({ items: [{ id: { videoId: "dQw4w9WgXcQ" }, snippet: { title: "T", channelTitle: "C" } }] })[0].title, "T");
  assert.deepEqual(fromPiped(null), []);
});
test("YouTube search falls back across instances and reports errors", async () => {
  const calls: string[] = [];
  const fake = (async (url: string) => {
    calls.push(url);
    if (url.includes("private.coffee")) return new Response("nope", { status: 503 });
    return new Response(JSON.stringify({ items: [{ type: "stream", url: "/watch?v=dQw4w9WgXcQ", title: "Hit" }] }));
  }) as unknown as typeof fetch;
  const r = await youtube.search!("never gonna", defaultSettings, fake);
  assert.equal(r[0].title, "Hit");
  assert.equal(calls.length, 4);
  const down = (async () => new Response("x", { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(youtube.search!("q", defaultSettings, down), /search_unavailable/);
});
test("SoundCloud links", () => {
  assert.equal(soundcloudUrl("https://soundcloud.com/artist/track-name?si=1"), "https://soundcloud.com/artist/track-name");
  assert.equal(soundcloudUrl("https://m.soundcloud.com/artist/sets/list"), "https://soundcloud.com/artist/sets/list");
  assert.equal(soundcloudUrl("https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fa%2Fb"), "https://soundcloud.com/a/b");
  assert.equal(soundcloudUrl("https://soundcloud.com/discover/x"), undefined);
  assert.equal(soundcloudUrl("https://soundcloud.com.evil.com/a/b"), undefined);
  assert.equal(soundcloud.parse("https://soundcloud.com/some-artist/my-track")?.title, "my track");
  assert.equal(soundcloud.search, undefined);
});
test("Spotify links and URIs", () => {
  assert.deepEqual(spotifyRef("https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=x"), { kind: "track", id: "4uLU6hMCjMI75M1A2tKUQC" });
  assert.deepEqual(spotifyRef("spotify:album:4uLU6hMCjMI75M1A2tKUQC"), { kind: "album", id: "4uLU6hMCjMI75M1A2tKUQC" });
  assert.equal(spotifyRef("https://open.spotify.com/user/x"), undefined);
  assert.equal(spotifyRef("https://spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"), undefined);
  assert.equal(spotify.parse("spotify:track:4uLU6hMCjMI75M1A2tKUQC")?.url, "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
});
test("oEmbed enrichment is optional", async () => {
  const fail = (async () => { throw Error("offline"); }) as unknown as typeof fetch;
  const it = spotify.parse("spotify:track:4uLU6hMCjMI75M1A2tKUQC")!;
  assert.deepEqual(await spotify.enrich!(it, fail), it);
  const ok = (async () => new Response(JSON.stringify({ title: "Song", thumbnail_url: "https://i.scdn.co/x.jpg" }))) as unknown as typeof fetch;
  assert.equal((await spotify.enrich!(it, ok)).artwork, "https://i.scdn.co/x.jpg");
});

test("slow public endpoint does not block another healthy search instance", async () => {
 const fake=(async(url:string,init:RequestInit)=>{
  if(url.includes('private.coffee'))return new Promise((_,reject)=>init.signal?.addEventListener('abort',()=>reject(Error('timeout'))));
  return new Response(JSON.stringify({items:[{type:'stream',url:'/watch?v=dQw4w9WgXcQ',title:'Available'}]}));
 }) as typeof fetch;
 const before=Date.now();const rows=await youtube.search!('test',defaultSettings,fake);assert.equal(rows[0].title,'Available');assert.ok(Date.now()-before<1000);
});
