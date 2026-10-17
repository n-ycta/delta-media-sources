## 0.2.2

- Four headless plugins in the common Plugins catalog: YouTube, SoundCloud, Spotify, and YouTube Offline. No separate provider apps or dock entries.
- YouTube search now uses bounded parallel fallbacks, request coalescing and a short result cache. Failures can be retried; a slow endpoint no longer serially blocks all alternatives.
- YouTube Offline exposes `downloads.status`, `create`, `job`, `cancel`, `read`, and `remove` to Delta and scoped MCP. Media presents one offline action with progress, cancellation and cached playback.
- The official yt-dlp engine is checksum-pinned and bundled with upstream license notices. Python 3.10+ is required on the download node; Node.js is supplied by the plugin runtime. Single-stream audio or video avoids an ffmpeg dependency.
- Cache files stay under the plugin's predefined private data/offline directory. Jobs are bounded, single-video YouTube URLs only, maximum 256 MiB per file and 2 GiB ready cache. Chunk reads are capped at 24 KiB; no arbitrary path, shell, cookies or DRM bypass API is exposed.

External services can rate-limit searches, deny an embed, require sign-in, or reject automated downloads. A real execution of the bundled yt-dlp engine was checked, but the sandbox YouTube IP was challenged; successful external download is not claimed. The cache-to-browser playback path is separately tested with real decoded WAV data and network disabled. SoundCloud/Spotify search requires configured credentials.
