# Decision History

## 2026-04-09

### 1. Ground Truth

User clarified that this project is view-first.

Confirmed:
1. baseline truth is not raw HTML or console output
2. final truth is browser-rendered view captured through Chrome + CDP
3. screenshots and measured rects are primary comparison inputs

Reason:
- some pages are partially redirected
- some areas are PC-like while others are MO-like
- browser-rendered result is more trustworthy than DOM-only interpretation

---

### 2. PC / MO strategy

Confirmed:
1. do not start from one responsive renderer
2. maintain separate `pc` and `mo` source sets
3. keep shared schema, separate source/variant/validation
4. execute page-groups in `pc + mo` together

Reason:
- site behavior is not a simple single responsive layout
- complete visual matching is easier with separate source sets

---

### 3. Representative sampling rule

Confirmed:
1. PLP representative sample = first visible product row
2. if first row has 4 products, capture all 4
3. PDP representative sample = every PDP reachable from the first PLP row

Reason:
- template differences appear at category/PDP level
- first-row sampling gives practical representative coverage

---

### 4. Quality rule

Confirmed:
1. final target is browser screenshot-level visual match
2. automated severity starts with:
   - blocker > 4px
   - warning 2px ~ 4px
   - cosmetic <= 2px

Reason:
- system needs replay automation
- user standard remains visual indistinguishability for normal users

---

### 5. Captured-first architecture

Confirmed:
1. all major slots/pages start from `captured/iframe` or captured-first source
2. then `custom` and `figma-derived` variants are layered on top
3. same slot can hold multiple source variants

Reason:
- baseline must remain preserved
- later editing should happen on editable variants, not captured baseline

---

### 6. Queue execution rule

Confirmed after resource issue:
1. do not run capture/extractor batches in parallel
2. use queue + single worker
3. replay jobs must be serialized
4. lock files must prevent duplicate runs

Reason:
- multiple Chrome headless/CDP sessions accumulated
- memory/CPU spike came from duplicated extractor/capture execution

Current implementation direction:
- `job_queue.mjs`
- lock-based single worker

---

### 7. LLM requirement expansion

User added requirements:
1. LLM should accept a reference URL and inspect that page/company structure
2. LLM should also accept natural-language-only instructions
3. LLM should compose the result
4. LLM should return a report with reasons
5. LLM should be able to operate inside component rules and design CSS constraints

Design response recorded:
1. LLM becomes:
   - reference-aware composition planner
   - slot / variant / rule patch editor
   - component authoring assistant
   - report generator
2. LLM must output:
   - `plan`
   - `patch`
   - `report`
3. LLM edits only:
   - `custom`
   - `figma-derived`
   variants
4. LLM uses:
   - token patch first
   - scoped CSS patch only when needed

Reference document:
- `docs/llm-composition-design.md`

---

### 8. Priority order

User explicitly corrected the order:

1. finish backend capture / extractor / workbench foundation first
2. finish current backend work in progress first
3. only after that, start LLM implementation

Important:
- LLM design documents may be prepared now
- LLM implementation must not jump ahead of backend foundation

This priority must not be changed unless the user explicitly changes it again.

---

### 9. Current active implementation priority

As of this decision log, active priority is:

1. queue-based extractor/capture stabilization
2. PDP group extraction
3. workbench group checks
4. continue backend baseline/workbench expansion
5. add minimal login/workspace layer
6. LLM implementation only after the above foundation is stable

---

### 10. Minimal login before LLM

User adjusted the order again:

1. do not leave login until the very end
2. add only the minimal login/workspace layer before LLM
3. do not introduce a large permission/admin system yet

Confirmed scope:
1. login/session only
2. per-account usage history
3. per-account work history
4. new account starts from shared default view

Confirmed non-goals for now:
1. no complex role system
2. no budget policy yet
3. no large admin layer yet

Implementation note:
1. `login.html` added
2. `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/session` added
3. per-account workspace is initialized from `shared default`
4. `admin` and editor/LLM APIs use user workspace data
5. public preview still reads shared default
6. `workspace reset to shared default` is supported for testing

### 11. Home-first detailed remediation

Confirmed:
1. `home` is currently the most visually divergent page
2. before LLM, `home` must be closed in detail
3. `home` remediation is tracked area-by-area:
   - `header-top`
   - `header-bottom`
   - `GNB open panel` for all 1depth menus
   - `hero`
   - `quickmenu`
   - `quickmenu-below`
   - `lower-content`
4. temporary floating/fixed overlay patches are not accepted as final solutions
5. `home` must be accepted visually, not only by backend checks

Reference document:
- `docs/home-remediation-plan.md`

