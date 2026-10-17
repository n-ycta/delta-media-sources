# Delta Media Sources

Three small portable Delta apps that **find** media and hand it to **any player** through host-mediated intents:

| App | ID | Find | Play (in Delta Media) |
| --- | --- | --- | --- |
| Delta YouTube | `dev.delta.youtube` | In-app search: your own YouTube Data API key, otherwise public Piped / Invidious instances (editable list); or paste a link | Official `youtube-nocookie.com` embed |
| Delta SoundCloud | `dev.delta.soundcloud` | Paste a track / playlist link (oEmbed metadata); "On site" opens soundcloud.com search | Official SoundCloud widget |
| Delta Spotify | `dev.delta.spotify` | Paste a link or `spotify:` URI (oEmbed metadata); "On site" opens open.spotify.com search | Official Spotify embed (30 s previews unless signed in to Spotify) |

Each item is sent with `host.sendIntent("media.play" | "media.enqueue", { provider, url, title, artist, artwork, duration, kind })`.
The host only routes it when the reviewed catalog lets the sender `send` and a receiver (Delta Media ≥ 0.2.0) `receive` that intent; payloads are plain JSON ≤ 64 KB. Any other app may declare `receive: ["media.play"]` and reuse these sources.

Honest limits: SoundCloud no longer issues public API keys and Spotify search requires OAuth, so neither has in-app search. Public Piped/Invidious instances come and go. No scraping, DRM or account bypass.

```
npm ci && npm test && npm run package:app   # release/delta-{youtube,soundcloud,spotify}.delta-app + SHA256SUMS
PROVIDER=spotify npm run dev                 # standalone preview of one app
```
