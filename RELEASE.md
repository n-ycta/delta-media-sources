## 0.2.5

- Follow the Invidious channel uploads endpoint and its continuation, rather than treating the 30-video channel preview as the complete collection.
- Add headless youtube.browse for channel cards, upload collections and playlist pagination.
- Use the configured official YouTube key, or validated Piped/Invidious instances.
- Attach channel links to search results and expose bounded continuation tokens.
- Fall back when a public instance returns an empty channel page despite advertising continuation.
- Reject malformed public API responses instead of showing a misleading empty playlist.
- Keep providers headless; Media remains the only player interface.

External playback, account restrictions and public-instance availability remain provider-dependent. Deterministic provider tests are not proof of unrestricted YouTube playback.
