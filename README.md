# Delta Media providers

YouTube, SoundCloud and Spotify are headless process plugins, not standalone applications. Install them from the common Plugins list and connect them in Media → Sources. They have no dock entries or independent screens.

Each exposes `<provider>.status`, `.settings`, `.search({query})` and `.resolve({url})` through Delta and the MCP capability catalog. Settings changes require administrator access; secrets are persisted privately and never returned.

YouTube supports a configured Data API key and public search services. SoundCloud search requires an OAuth access token. Spotify search requires a client ID and secret. Resolving a supported public link does not require search credentials. Playback access remains subject to each platform’s account and embedding restrictions.

Build: `npm ci --ignore-scripts && npm test && npm run package:plugins`. Release assets are three `.tar.gz` process plugin packages plus SHA256SUMS.
