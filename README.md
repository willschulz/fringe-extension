# Fringe Detector

Fringe Detector is an experimental Chrome extension that adds related
public-opinion survey questions to posts on X/Twitter, Bluesky, and Reddit.
It is designed to help people compare what appears in a social feed with
systematic survey evidence.

This is an alpha research prototype. It currently retrieves related survey
questions; it does **not** yet determine whether a post is mainstream or
fringe. Response-distribution and stance-classification work must be validated
before the extension can make that stronger claim.

## Privacy summary

When annotation is enabled, the extension sends the text of visible supported
posts to the configured search service. It does not send account cookies,
credentials, private messages, browsing history, or page content outside the
supported post containers. Annotation starts disabled and can be paused at any
time.

The pilot search service requires a separately supplied access token. Do not
commit or share that token. See [PRIVACY.md](PRIVACY.md) for the complete data
flow and retention expectations.

## Install the pilot build

1. Download and unzip the pilot release.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the unzipped extension directory.
5. Open the extension from Chrome's Extensions menu.
6. Paste the pilot token supplied separately, test the connection, and enable
   annotation.
7. Reload an open X/Twitter, Bluesky, or Reddit tab.

Chrome does not update unpacked extensions automatically. For a new pilot
build, remove the old unpacked extension or select **Reload** after replacing
its files.

The tester-facing walkthrough and feedback prompts are in
[LISA_PILOT_GUIDE.md](LISA_PILOT_GUIDE.md).

## Supported sites

- `x.com` and `twitter.com`
- `bsky.app`
- current Reddit (`reddit.com`); old Reddit is not supported

The supported sites change their markup without notice. A missing badge may
mean either that no reliable survey match exists or that a site selector needs
updating.

## Known alpha limitations

- Topic similarity does not guarantee that a survey question measures the
  stance expressed in a post.
- Some matrix/battery questions have generic wording without enough item
  context.
- Lifestyle and non-U.S. coverage is thinner than U.S. political coverage.
- The first readiness set found one clear displayed false positive in 19 badge
  cases; see the [evaluation report](evaluation/2026-08-17-readiness.md).
- Site markup changes can temporarily stop post extraction or badge placement.

## What a badge means

A badge means that the search service found one or more survey questions
related to a visible post and judged the match strong enough to display. It
does not mean that the post endorses a particular response option, and it does
not yet measure how common the post's view is.

## Development

The extension is a Chrome Manifest V3 project with no build step. Load the
repository directory as an unpacked extension during development.

Run the fixture-driven tests with:

```bash
npm test
```

Run the live Chrome smoke harness with a token supplied through the environment:

```bash
DEMOSCOPE_API_TOKEN='...' npm run test:browser
```

Build a pilot ZIP, checksum, and SSH signature with:

```bash
FRINGE_SIGNING_KEY="$HOME/.ssh/id_rsa" ./scripts/package-release.sh
```

To verify a downloaded release:

```bash
shasum -a 256 -c fringe-detector-pilot-v0.2.0.zip.sha256
printf 'willschulz %s\n' "$(cat RELEASE_SIGNING_KEY.pub)" > allowed_signers
ssh-keygen -Y verify -f allowed_signers -I willschulz -n file \
  -s fringe-detector-pilot-v0.2.0.zip.sig \
  < fringe-detector-pilot-v0.2.0.zip
```

The public repository contains extension source, tests, and synthetic fixtures
only. The private survey corpus, derived search index, service credentials,
and pilot access tokens are not part of this repository.

## Architecture

The content script observes supported posts that enter the viewport. A service
worker sends bounded search requests to a token-protected API and caches
results for the browser session. The API returns an allowlisted set of survey
question metadata; raw survey files and respondent microdata are not exposed.

See [docs/API.md](docs/API.md) for the pilot API contract.

## License

Extension code is available under the [MIT License](LICENSE). Survey question
metadata returned by the search service remains subject to the terms and
attribution requirements of its original survey publishers; see
[SURVEY_SOURCES.md](SURVEY_SOURCES.md).
