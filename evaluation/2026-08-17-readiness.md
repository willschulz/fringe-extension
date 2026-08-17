# Pilot retrieval readiness — 2026-08-17

## Decision

Proceed with a controlled colleague pilot, while retaining the alpha language
and asking specifically about bad matches. Do not broaden the survey corpus
before the pilot.

The service returned a useful displayed result for 18 of 24 representative
post-like statements. One additional displayed result was a clear false
positive, and five unsupported topics were safely suppressed. There were no
request errors. This is adequate for exploratory usability feedback, not for a
claim that the extension reliably classifies views as fringe or mainstream.

## Method

- 24 synthetic statements spanning domestic policy, international affairs,
  online culture, lifestyle, and identity/values.
- Live guarded public endpoint and the 29,921-question index.
- Three hits requested per statement with `min_n=500`.
- Server weak-match policy applied first.
- Automated top-hit lexical check followed by manual review of all displayed
  and suppressed cases.
- Raw, reproducible output:
  [`results/2026-08-17.json`](results/2026-08-17.json).

## Results

- 24 total cases.
- 19 produced a badge; 5 were suppressed.
- 18 of 19 displayed cases were useful or reasonably related (94.7% observed
  display precision).
- 18 of 24 cases had useful displayed context (75.0% useful coverage).
- 1 clear displayed false positive (5.3% of displayed cases).
- 0 HTTP or API errors.
- Median end-to-end request latency: 958 ms.

The first run exposed a weak-match failure for Ukraine funding: the first RRF
hit was weak even though two stronger Ukraine questions followed it. The pilot
route now judges the full top-k set and removes individually weak candidates.
The second run changed that case from suppressed to a useful two-question
result without activating any of the five unsupported topics.

## Manual-review cases

### Creator revenue sharing — false positive

The statement about guaranteed creator revenue share displayed a knowledge
question about the largest source of social-platform revenue. The vocabulary
overlap is real, but the result does not measure support for creator pay.
There is no clear question in the current corpus that resolves this gap.

This is the main known false-positive scenario for the pilot. Raising the
global threshold enough to suppress it would also hide useful election-fraud,
AI-regulation, and Ukraine results, so the fixture does not justify a global
threshold change. A later reranking/classification phase should distinguish
topic overlap from an attitude question that can contextualize the post.

### NATO commitment — useful but poorly ordered

The first two GSS results contain generic card wording whose omitted item label
makes them hard to interpret. The third result directly asks about European
allies' defense spending and is useful. This points to a metadata/rendering
problem for generic battery stems, not a missing-survey problem.

## Safely suppressed coverage gaps

The server suppressed statements about abolishing the UK monarchy, the
morality of eating meat, polyamory acceptance, homeschooling freedom, and
masculinity norms. The returned candidates were weak or mismatched. These are
real coverage gaps but are not a reason for broad corpus expansion before a
small usability pilot.

## Source-permission gate

The public repository contains no survey corpus. The guarded API returns only
search-selected question metadata and excludes Knight/Gallup records because
their published materials carry proprietary notices without a clear extracted
question redistribution license. Pew, ANES, GSS, and CES terms and required
attributions are summarized in [`../SURVEY_SOURCES.md`](../SURVEY_SOURCES.md).

The current conclusion is intentionally narrow: controlled access for one
research colleague is supportable with attribution and revocable credentials.
Unrestricted API or Web Store publication requires a release-level terms
audit, especially for Pew American Trends Panel materials.

## Pilot feedback prompts

Ask the tester to flag:

1. a badge whose survey question is about the same words but a different
   attitude;
2. a post that clearly has relevant survey evidence but gets no badge;
3. generic or truncated question wording that is not interpretable;
4. request delays that disrupt feed reading; and
5. whether the privacy/alpha explanation is clear before enabling.
