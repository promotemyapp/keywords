# API implementation guidance

Keep the API portable, predictable, safe, and easy for another project or agent to consume. The API adapts the keyword-research configuration into reusable briefs.

- Keep the versioned `/v1` routes stable.
- Keep direct requests stateless and return the resolved configuration.
- Keep guided sessions signed, short-lived, and independent of server memory.
- Validate all external input at the boundary and return stable JSON errors.
- Keep request bodies below the one-megabyte limit.
- Test health, discovery, direct and guided flows, invalid input, expiry, and missing secrets.
