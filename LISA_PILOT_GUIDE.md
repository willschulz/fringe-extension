# Lisa pilot guide

Thank you for testing this early research prototype. The goal is to learn
whether related survey questions are useful while reading social feeds and
where the matching gets things wrong.

## What it does

On X/Twitter, Bluesky, and current Reddit, the extension may add a compact
“Related public-opinion data” control below a visible post. Opening it shows up
to three survey questions.

A badge means “the search service found related survey material.” It does not
mean the extension has determined that the post or its author is fringe,
mainstream, true, or false.

## Privacy before you enable it

When enabled, the text of visible supported posts is sent over HTTPS to Will's
research server. The extension does not intentionally send your account
cookies, credentials, private messages, author profile, or unrelated page
content. Search text is placed in a POST body and is excluded from edge and
application logs.

The extension starts paused. You can pause it at any time from its Chrome
toolbar popup. Full details are in [PRIVACY.md](PRIVACY.md).

## Install

1. Download the pilot ZIP attached to the GitHub release.
2. Unzip it. Keep the resulting folder until the pilot is over.
3. In Chrome, open `chrome://extensions`.
4. Turn on **Developer mode** in the upper-right corner.
5. Select **Load unpacked**.
6. Choose the unzipped `fringe-detector-pilot-v0.2.0` folder.
7. Pin **Fringe Detector (Alpha)** from Chrome's Extensions menu.
8. Open the extension, paste the token Will sent through a separate channel,
   and choose **Save & test**.
9. After the connection succeeds, enable **Annotate supported feeds**.
10. Reload any already-open X, Bluesky, or Reddit tab.

Do not put the token in email feedback, screenshots, issue reports, or GitHub.
If it is accidentally shared, tell Will so it can be revoked.

## Suggested test

Spend a few minutes on each supported site:

1. Open ordinary feed or thread pages on X/Twitter, Bluesky, and Reddit.
2. Expand several badges and decide whether the survey questions genuinely
   help contextualize the post.
3. Look for an opinionated post that gets no badge.
4. Pause annotation from the popup and confirm new badges stop appearing.
5. Re-enable it and reload the page.

## Feedback checklist

For each problem, please copy the public post URL and describe:

- **Bad match:** same words, but the survey question measures a different idea.
- **Missed match:** no badge even though relevant survey evidence likely exists.
- **Unclear question:** wording, response options, or source/year is confusing.
- **Placement problem:** the badge overlaps or disrupts the site's controls.
- **Performance problem:** scrolling feels slower or requests take too long.
- **Privacy/consent problem:** the popup does not make the data transfer clear.

Please also say what was useful. A few concrete examples are more valuable
than a general rating.

## Stop or remove

- Pause immediately: open the extension and turn off **Annotate supported
  feeds**.
- Remove completely: open `chrome://extensions`, find the extension, and
  select **Remove**. Chrome will delete its locally stored token and settings.

This is a time-limited colleague pilot. It is not a Chrome Web Store release or
a research-participant deployment.
