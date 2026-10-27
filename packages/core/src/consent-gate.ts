/*
 * Consent gate (task 1.1, 1.2, 1.3). The provider table below is filled in as SDK facts are verified; the
 * loader, start and stop logic is added by task 5.1.
 *
 * Verified SDK facts, observed in headless Chromium with the shipped loaders (2026-10-26). Requests to the
 * provider hosts were aborted, so no analytics event left the machine. Fixture: test/fixtures/consent-sdk-storage.json.
 *
 * | Provider | Cookie names | localStorage names | sessionStorage names | Opt-out / clear calls | Stop in place |
 * |---|---|---|---|---|---|
 * | PostHog (`phc_qiVV...PER5`, loader from `posthogInitScript`) | `ph_<key>_posthog` (written after the first `capture` on an opted-in page) | `ph_<key>_posthog`, `__ph_opt_in_out_<key>` (opt-out state) | `ph_<key>_session_registered_properties`, `ph_<key>_primary_window_exists` | `opt_out_capturing()` writes the opt-out state; `opt_in_capturing()` not observed; `clear_opt_in_out_capturing()` removes `__ph_opt_in_out_<key>` only. Opt-out is not a cleanup: `ph_` cookie and storage stay and must be removed by the gate. | Documented: opting out stops all capture, autocapture and session replay on the client. Not observed: the harness never let capture reach the network, so `stopInPlace` stays false until the group-10 browser check (10.2) confirms no request after reject. |
 * | Google Analytics (`G-EN03FMT2Q4`, `gtag.js`) | `_ga`, `_ga_<id>` where `<id>` is the measurement ID without the `G-` prefix (`_ga_EN03FMT2Q4`), both set on the page host after `config` | none | none | `window['ga-disable-<id>'] = true` set before `gtag.js` runs: no cookie and no `collect` request. Set after `config` (the in-place case): `collect` requests are still attempted, so the flag does not stop an initialized page in place. | false, reload on withdrawal |
 * | 51LA (`L6b88a5yK4h2Xnci`, `sdk.51.la/js-sdk-pro.min.js`) | not observed: `sdk.51.la` does not resolve from this machine (DNS) | not observed | not observed | task 1.3 is open: the SDK source could not be fetched here, so no stop or consent API is recorded | always reload (hard-coded) |
 */
export {};
