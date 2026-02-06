# Specification

## Summary
**Goal:** Make location detection reliable and understandable by requiring explicit user action for GPS, adding a resilient GPS retry strategy, improving failure guidance, and hardening IP-based fallback.

**Planned changes:**
- Update the location detection UX so the app does not auto-request GPS on first load; only request geolocation after the user clicks “Use My Current Location,” while keeping existing status messaging visible and accurate.
- Implement a two-pass GPS detection flow: try high-accuracy geolocation first, then retry once with lower-accuracy settings on timeout/POSITION_UNAVAILABLE before falling back to IP-based geolocation (ensuring only one fallback path runs and UI states don’t get stuck).
- Add clear, actionable English guidance for common location failures (non-secure context/HTTPS requirement, permission denied with instructions to re-enable, geolocation not supported), including options to retry and use city search.
- Update the backend IP geolocation outcall to use an HTTPS endpoint/provider and keep response parsing compatible with the frontend’s expected fields (lat, lon, city, country, status/message equivalents), including safe handling of error payloads.

**User-visible outcome:** On first load, the app won’t prompt for GPS permissions automatically; users can click “Use My Current Location” to start detection with clearer progress and troubleshooting, and if GPS fails the app reliably falls back to IP-based location without repeated toasts or stuck states.
