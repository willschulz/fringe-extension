# Privacy and data flow

## What leaves the browser

When the user explicitly enables annotation, Fringe Detector sends:

- the visible post's extracted text, truncated to the client and server limits;
- a locally derived post identifier used only for session deduplication; and
- the pilot API token in the HTTPS `Authorization` header.

Requests are limited to supported post containers on X/Twitter, Bluesky, and
Reddit. The extension does not intentionally collect account cookies,
authentication credentials, private messages, author profiles, browsing
history, or content from unrelated sites.

## Why it is sent

The text is used to retrieve related public-opinion survey questions. Search
cannot currently run entirely in the browser because the derived survey index
and embedding service live on the research server.

## Browser storage

Chrome local extension storage contains:

- whether annotation is enabled;
- the pilot API URL;
- the pilot access token; and
- the last connection-test status.

Search results are cached only in the extension service worker's memory and
may disappear whenever Chrome suspends that worker. The extension does not
persist post text or search results to disk.

## Server handling

The pilot endpoint accepts post text in an HTTPS POST body so it is not placed
in the URL. Edge and application access logs must not record request bodies or
authorization headers. Operational logs retain status, latency, and a
non-reversible request identifier only. Failed searches must not log the post
text.

The service returns allowlisted survey-question metadata. It does not expose
raw corpus files, respondent microdata, internal filesystem paths, or service
credentials.

## User control

Annotation starts disabled. The extension popup explains the data transfer,
lets the user test the configured service, and provides an immediate pause
control. Disabling or removing the extension stops new requests. Removing the
extension also removes its local settings and token.

## Pilot credentials

Pilot tokens are individually revocable and are delivered separately from the
extension package. They must never be committed to Git, placed in a release
archive, or pasted into issue reports.

## Research use

This alpha is intended for controlled usability testing, not participant
deployment. Any later research study requires its own consent language,
retention policy, ethics review as applicable, and a re-review of the
extension's data flow.
