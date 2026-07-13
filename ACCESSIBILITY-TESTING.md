# Accessibility Testing — automated checks plus human judgment

> Automated accessibility tools are necessary but insufficient. They identify some potential violations; they cannot determine accessibility by themselves. Use WCAG 2.2 success criteria as the current baseline, subject to the product's applicable legal and contractual requirements.

## 1. Automated CI checks

Run mechanically testable checks on critical pages and changed components:

- axe or ACT-compatible rules;
- semantic roles and accessible names;
- duplicate IDs and invalid ARIA;
- mechanically testable color contrast;
- form-control labels and programmatic error associations where tooling can verify them.

Treat a detected violation as actionable. Treat a clean scan as incomplete evidence, not an accessibility sign-off.

## 2. Manual or assisted checks

Review critical flows with:

- keyboard-only navigation, visible focus, and logical focus order;
- zoom and reflow;
- form labels, validation messages, and error recovery;
- heading hierarchy and landmarks;
- image alternative appropriateness;
- captions, transcripts, and media controls;
- a screen-reader smoke test using the supported browser/assistive-technology combinations.

W3C-style quick checks are useful smoke checks, not a complete evaluation. Include the flow, environment, findings, and any exception in the release evidence.

## 3. Test design and review

- Prefer user-facing roles and accessible names for E2E selectors; this makes tests both more resilient and more likely to expose missing semantics.
- Test accessibility changes against the relevant WCAG 2.2 criterion or product requirement, not just tool output.
- For visual regression, review semantic and interaction impact separately; pixel stability is not accessibility evidence.
- Include people with relevant disabilities and assistive-technology expertise when the risk or scope warrants it.
