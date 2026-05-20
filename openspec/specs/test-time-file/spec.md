# test-time-file Specification

## Purpose

TBD - created by archiving change create-time-md. Update Purpose after archive.

## Requirements

### Requirement: Repository time marker file

The repository SHALL contain a root-level `time.md` file whose content records the timestamp captured for this workflow smoke test.

#### Scenario: Apply creates time marker

- **WHEN** the `create-time-md` change is applied
- **THEN** the repository root SHALL contain `time.md` with exactly the content `2026-05-20 18:35:57 CST` followed by a single trailing newline
