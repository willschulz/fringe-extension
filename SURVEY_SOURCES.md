# Survey sources, terms, and attribution

The MIT License in this repository applies to the extension source code. It
does not relicense survey questions or other metadata returned by the search
service. Those materials retain their publishers' terms.

The pilot API returns a small, search-selected subset of question wording,
response options, source, year, sample size, variable identifier, and match
score. It does not distribute respondent records, raw survey files, complete
codebooks, or the private derived search index.

## Pew Research Center

Source: [Pew Research Center datasets and questionnaires](https://www.pewresearch.org/datasets/)

Use requires attribution and compliance with Pew Research Center's
[Terms of Use](https://www.pewresearch.org/about/terms-and-conditions),
including any separate terms that govern American Trends Panel materials.

Required disclaimer:

> Pew Research Center bears no responsibility for the analyses or
> interpretations of the data presented here. The opinions expressed herein,
> including any implications for policy, are those of the author and not of
> Pew Research Center.

## American National Election Studies

Source: [ANES Data Center](https://electionstudies.org/data-center/)

ANES public-release datasets are public goods for research and statistical
use. Users must protect respondent confidentiality, cite the relevant ANES
data and documentation, and acknowledge that ANES and its funders bear no
responsibility for interpretations.

## General Social Survey

Source: [GSS at NORC](https://gss.norc.org/)

GSS asks users to make responsible use of its data and documentation and to
cite the relevant release. Its codebook permission requires retention of the
copyright and permission notice and limits distribution charges to duplication
costs. See the current [GSS terms and citation
guidance](https://gss.norc.org/terms-and-conditions.html).

## Cooperative Election Study

Source: [CES/CCES Dataverse](https://dataverse.harvard.edu/dataverse/cces)

The checked Common Content releases are published under CC0 in Harvard
Dataverse. Dataverse community norms and scientific practice still require
citation of the specific release.

## Excluded from the public pilot API

Knight Foundation/Gallup materials remain searchable in the owner's private
demoscope UI but are excluded from the guarded pilot endpoint. Their published
reports carry proprietary Gallup notices and do not provide a sufficiently
clear license for redistributing extracted question text through this API.
They should be enabled only after written permission or a source-specific
legal review.

## Before broader release

This source-by-source review is adequate for a controlled colleague pilot, not
a legal opinion. Before a Chrome Web Store or unrestricted API release:

1. verify the exact release-level terms for every indexed wave;
2. preserve source-specific citations and notices in the UI;
3. obtain clarification for Pew American Trends Panel question redistribution;
4. keep proprietary or unclear sources excluded; and
5. re-audit whenever a new source or metadata field is exposed.
