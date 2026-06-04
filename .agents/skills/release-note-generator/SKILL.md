---
name: release-note-generator
description: Generate concise user-facing release notes for GitHub Releases or similar announcement surfaces from changelogs, tags, and shipped changes. Use when the user asks for release notes, highlights, launch copy, first-screen summaries, or bilingual GitHub release content rather than full historical changelog entries.
---

# Release Note Generator

Use this skill for GitHub Release pages and other announcement-style release summaries. Prefer it when the target artifact is a release post, release description, first-screen summary, or launch note rather than `CHANGELOG.md`.

## Bilingual Mode

When the user asks for Chinese and English, produce both language versions as first-class outputs.

- If the user asks for GitHub Release copy, provide both language sections in the same response unless the repo has separate release-note files.
- Keep both versions equivalent in message priority, highlight ordering, and disclosure of breaking changes or known issues.
- Do not make one version shorter in substance unless the user explicitly asks for asymmetric detail.

## Workflow

1. Read the existing changelog entry first if one exists. Use it as the source of truth for what shipped.
2. If no changelog entry exists yet, derive the shipped scope from tags, commits, touched files, and relevant specs.
3. Identify the top 3 to 5 user-visible outcomes of the release.
4. Compress the release into a first-screen summary:
   - one short intro paragraph
   - a short `Highlights` section
5. Add secondary sections only when the release is large enough to justify them.
6. If the user wants multiple languages, keep the language versions equivalent in meaning and emphasis.
7. If the user explicitly requests bilingual output, finish both language versions before ending the task.

## Release Note Rules

- Release notes are shorter than changelog entries.
- Prioritize user impact over implementation detail.
- Do not dump raw commit subjects, PR titles, or file lists into the release page.
- The first screen should be skimmable in seconds.
- Lead with the most important user-visible improvements and fixes.
- Mention internal refactors only when users directly benefit from them.
- If there are breaking changes, migrations, or known issues, give them their own explicit section.
- For bilingual release notes, keep the two versions equally release-ready. Do not leave one as a rough translation stub.

## Recommended Structure

For a typical GitHub release, prefer:

1. Title: `Product vX.Y.Z`
2. Intro paragraph: 2 to 4 sentences on the theme of the release
3. `Highlights`: 3 to 5 bullets

Optional follow-up sections:

- `Fixed`
- `Breaking Changes`
- `Known Issues`
- `Notes`

If the user explicitly wants a first-screen summary, avoid deeper sections unless they are necessary.

## Writing Style

- Write for end users, not commit archaeology.
- Keep bullets short and value-oriented.
- State the effect, not just the action.
- Prefer "Added version checking in the About panel" over "Implemented GitHub release version check service".
- Avoid hype and marketing filler.
- Keep the tone clear, direct, and release-ready.
- Favor wording that works across coding-product releases, not just one repo's internal terminology, unless the product already uses those terms publicly.

## Language Guidance

- English release notes should read naturally, not like a literal translation.
- Chinese and English versions should keep the same claims, order of emphasis, and risk disclosures.
- When a shorter summary is requested, compress both languages proportionally.
- If the user does not specify an order, default to Chinese first and English second for Chinese-speaking teams, or follow the repo's existing convention if one is established.

## Output Shapes

### First-screen GitHub Release summary

```md
## Product vX.Y.Z

Short summary paragraph.

### Highlights

- ...
- ...
- ...
```

### Expanded release note

```md
## Product vX.Y.Z

Short summary paragraph.

### Highlights

- ...

### Fixed

- ...
```

## Verification

- Ensure every highlighted point is actually shipped in the target release range.
- Check that the summary does not overclaim compared with the changelog or code.
- If bilingual notes are produced, verify parity before finalizing.
