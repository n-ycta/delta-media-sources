# Third-party engine

The offline plugin bundles the official yt-dlp Python executable pinned in `engine/pin.json`. Its SHA-256 is verified at package build time.

Project: https://github.com/yt-dlp/yt-dlp
Release: https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19
License: Unlicense for yt-dlp original code; bundled dependencies retain their own licenses reproduced in `YT_DLP_THIRD_PARTY_LICENSES`. See the bundled `YT_DLP_LICENSE` and `YT_DLP_THIRD_PARTY_LICENSES` for complete terms.

Python 3.10+ and Node.js are runtime prerequisites. No ffmpeg or separately merged format is required by this plugin's single-stream selection. No DRM or account restriction bypass is provided.
