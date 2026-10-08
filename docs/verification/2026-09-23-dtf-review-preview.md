# DTF hat review preview

Root cause: instantPreview only composites supported flat front placements; front_dtf_hat intentionally returns null. The review UI automatically requested and polled actual supplier previews only for embroidery. Non-embroidered held jobs therefore needed a separate manual request hidden behind the placement review disclosure, and adjustments did not trigger that request.

Fix: all held review designs use the existing cached supplier rendering endpoint automatically. Their review panel opens by default, reports queue/rendering progress, polls to completion, and exposes retry on errors. Approval requires the actual preview image to load. Adjustment clears the old preview and the existing job refresh/remount starts rendering the newly prepared placement. First approved product colors retain priority over review rendering; generation does not approve or publish the held product.

Verification: TypeScript passed; scoped ESLint has only existing img warnings; all 165 tests passed. Targeted manual code review used because the branch contains unrelated work; no commits created. Production deployment aliased successfully. Live browser verification script checks Sunday Sauce and Mazellist image loading without manually requesting a mockup and confirms approval is still required.

Live result: both Sunday Sauce and Mazellist actual DTF hat images loaded in authenticated browser review cards, with approval still required. Mazellist initially exceeded the browser wait while slots were busy; its review endpoint subsequently completed successfully and the final browser rerun passed for both stores. Temporary test admin accounts and session files were removed. No product approval or purchase occurred.
