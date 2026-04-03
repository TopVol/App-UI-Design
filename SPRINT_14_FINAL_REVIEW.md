Sprint 14 Final Review

Branch
- sprint-6-legacy-restore

Compare snapshot against main
- status: diverged
- ahead by: 17 commits
- behind by: 2 commits
- merge base: d87c8779713b252d0f342a055e325d5b366fd5a2

Meaning
The recovery branch is not only ahead of main, it is also behind it.
A clean merge review should therefore include a branch sync step before final merge readiness.

High-value files added on this branch

Recovery and review docs
- RECOVERY_STATUS.md
- BRANCH_MERGE_CHECKLIST.md
- PR_SUMMARY.md
- JS_TS_ALIGNMENT_NOTES.md
- legacy/BRANCH_NOTE_sprint-6.txt

Restored or bridged legacy files
- files/examples.js
- mvp_demo_v4.8.html

TypeScript recovery layer
- src/types/window.types.ts
- src/engine/layout-tree.ts
- src/engine/constraint-engine.ts
- src/controller/resize-controller.ts
- src/state-store.ts
- src/engine/legacy-compat.ts
- src/state-store.compat.ts
- src/README.md

Project metadata
- package.json
- tsconfig.json

Sprint 14 recommendation
1. sync the branch with current main
2. rerun local checks
3. review the compat-layer decision
4. only then consider merge readiness

Local checks after sync
- npm install
- npm run typecheck
- node files/examples.js
- visually verify index.html
- visually verify mvp_demo_v4.8.html
