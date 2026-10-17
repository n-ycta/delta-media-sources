# Delta Media providers

YouTube, SoundCloud, Spotify and YouTube Offline are headless process plugins, not standalone applications. Install them from the common Plugins list and connect them in Media → Sources. They have no dock entries or independent screens.

Each exposes `<provider>.status`, `.settings`, `.search({query})` and `.resolve({url})` through Delta and the MCP capability catalog. Settings changes require administrator access; secrets are persisted privately and never returned.

YouTube supports a configured Data API key and public search services. SoundCloud search requires an OAuth access token. Spotify search requires a client ID and secret. Resolving a supported public link does not require search credentials. Playback access remains subject to each platform’s account and embedding restrictions.

Build: `npm ci --ignore-scripts && npm test && npm run package:plugins`. Release assets are four `.tar.gz` process plugin packages plus SHA256SUMS.

## Offline caching

Install `delta-downloads.tar.gz` on the node (Python 3.10+ required). The bundled official yt-dlp engine is pinned by `engine/pin.json`, verified during packaging, and includes upstream license notices. Media offers the plugin during installation and displays one stateful offline icon per YouTube library entry. Configure audio-only or video copies in Media settings; files use the private plugin `data/offline` directory instead of a Save As dialog.

Capabilities: `downloads.status`, `.create({url,kind})`, `.job({id})`, `.cancel({id})`, `.read({id,offset,limit})`, `.remove({id})`. Writes require administrative authorization; all calls preserve the caller's Delta scopes. Reads return at most 24576 bytes per chunk. Cache limits are 256 MiB per file and 2 GiB total ready files. Use `.remove` to free node cache; browser copies are device-local.

YouTube may challenge the download node, require sign-in, or restrict a video. The plugin reports failure rather than pretending the item is offline. No cookies, account security bypass, or DRM extraction is supported.
