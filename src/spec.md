# Specification

## Summary
**Goal:** Make location tracking feel stable and predictable, and ensure the total visit counter is always visible and resilient to transient failures and backend upgrades.

**Planned changes:**
- Prevent the one-time “Detect My Location” flow from running while continuous tracking is active (require stopping tracking or otherwise gate the action).
- Throttle/debounce tracking-triggered searches by enforcing a minimum time interval between searches while keeping the existing “significant change” check.
- Reduce toast/notification noise during tracking by only showing toasts for start/stop and meaningful state changes (e.g., first fix acquired, permission denied, tracking errors).
- Improve tracking error recovery so transient `watchPosition` errors (TIMEOUT/POSITION_UNAVAILABLE) update UI state without leaving the app stuck, and allow stop/restart without refresh.
- Always render a “Total visits:” row in the footer; if the counter fails, show an English fallback value (e.g., “unavailable”) instead of hiding it.
- Add a lightweight frontend retry for counter fetch/increment (at least one retry after a short delay) without blocking the UI.
- Persist the backend page view counter in stable canister state so it survives future canister upgrades, without changing `incrementPageViews()` / `getPageViews()` signatures.

**User-visible outcome:** Location tracking no longer competes with manual detection and triggers fewer noisy updates; tracking errors are recoverable via stop/restart. The footer consistently shows “Total visits:” with a clear fallback when unavailable, and the counter no longer resets after backend upgrades.
