# Automated logo comparison

Implemented image-pair comparison before storing an enhanced print logo. Deterministic screening compares alpha and composited color differences globally and in 64 tiles; a fal.ai/OpenRouter Gemini 2.5 Flash vision call independently transcribes original/enhanced text and checks shapes, colors and edges. Strict response parsing, uncertain results, failed requests and invalid outputs all retain admin review. Exact image SHA-256 pairs bind cached results. No credentials or signed URLs are persisted in the comparison.

A passing comparison can remove the enhanced-image/original-resolution review requirement, but cannot bypass insufficient output resolution, the existing 75 source-PPI lower bound, embroidery or semi-transparency holds. Smallest lettering is estimated by the model and screened against an internal 0.08-inch minimum at each print placement. This estimate and the thresholds are internal screening policies, not Printful certification or a print-quality guarantee. Very small lettering or unassessable images stay in review.

## Validation

- Full test suite: 107 passed.
- TypeScript and scoped ESLint passed.
- Additional cache-mismatch test confirmed a pass for other image bytes is discarded.
- Live fal test: matching vector-rendered enlargement passed; deliberate E-to-F substitution was identified and held.
- Live Sunday Sauce check: pixel differences were small, but the model flagged possible jagged/pixelated letter edges on SUNDAY/PODCAST. The seven current holds retain review, with comparison evidence saved and no orders submitted.
- Authenticated browser workflow not exercised because the available browser session is signed out.

## Code review

Actionable Findings: no outstanding code defects after the hash-cache test and bounded image normalization fix. Simplification/reuse, correctness, failure handling, credential boundaries and tests were reviewed sequentially in the main task under the repository's no-subagent instruction. No independent reviewer was run.

Coverage: visual-comparison.ts, prepared-logo.ts, print-quality.ts, their tests and the bounded operational scripts. Reviewed timeout handling, malformed model replies, alpha/color changes, stale cached passes, per-placement gates and upload-only invocation. Existing lifecycle/email code remains in place.

Verdict: ready with stated limits. Model false positives/negatives remain possible; this is automated screening, not verification of physical manufacture. A completed comparison is cached to avoid repeated calls. Provider failures fail closed and may require an admin review.

## Production validation

After deployment, verify production alias and stored Sunday Sauce review evidence. Existing cron delivery handles admin notifications. Roll back the comparison gate if mismatched images auto-pass, unsafe placements bypass hard gates, or upload requests fail rather than falling back to admin review. Preserve image evidence to diagnose any reported print issue. No new recurring monitor is scheduled.

Sources: https://fal.ai/models/openrouter/router/vision/api and Printful's Smart Image Tool guidance cited earlier in this task. Provider receives cleaned and enhanced logo images only, with web search disabled.
