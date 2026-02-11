# Copilot Instructions for This Workspace

This workspace contains a **mixed archive** (CAD, firmware, academic docs) with one **actively developed web app** — a teaching load calculator (Beban Tugas Akademik) for Malaysian academic institutions. Below is essential knowledge for AI agents to be productive immediately.

## System Architecture

**Stack**: Single-page HTML/JS frontend + Google Apps Script backend + Google Sheets persistence.

**Components**:
- **Frontend:** [BTA.html](BTA.html) (2026 lines, vanilla JS, no build step)
  - Calculations engine: real-time teaching load computation with Malaysian academic rules
  - Data layer: localStorage for caching, IndexedDB for backup file handles, JSON import/export
  - API layer: fetch/JSONP to Google Apps Script deployed Web App + fallback to google.script.run (preview mode)
  - UI: Material-like CSS, KaTeX for formula rendering, responsive mobile design
  
- **Backend:** [apps-script/Code.gs](apps-script/Code.gs) (792 lines, Google Apps Script)
  - Web App handlers: `doGet()`, `doPost()`, `doOptions()` route to business logic handlers
  - Sheet CRUD: `handleSubmit_()`, `handleUpsertLecturerRow_()`, `handleDeleteLecturerRow_()`, `handleDecision_()`
  - Approval flow: email verification tokens, two-person validation (L1 helper, L2 subject owner)
  - APIs for testing: `apiGetLecturerRows()`, `apiUpsertLecturerRow()`, `apiGetStatuses()`, etc.

- **Persistence Sheets** (in Google Sheets, ID in `SPREADSHEET_ID` const):
  - `Requests`: rows submitted for approval (request_id, record_id, status, approval_token)
  - `All_lecturer_record`: lecturer's local cache of all their rows (helper_lecturer_email, verify_status, jam_beban_calc)
  - `Subjects`: subject-to-owner mapping (subject_code, owner_email) for approval routing

## Teaching Load Calculation Model

**Formula** (baked in frontend [lines 513–530](BTA.html#L513)):
$$\text{Jam Beban} = (A \times H \times F) + (G \times F)$$

Where:
- $A$ = jam_minggu (weekly class hours)
- $H$ = baseCoeff (weight: 3 for Kuliah/Kumpulan Pertama, 2 for Kuliah/Kumpulan Ulangan or Makmal, 1 for Tutorial)
- $F$ = bilanganMinggu (weeks in semester)
- $G$ = jamPelajar (student load) = max(0, bilangan_pelajar - threshold) × 0.033
- Threshold: 30 for most courses, **15 for Makmal Program Teknologi** (Btech labs)

**Course types** ([getActivityConfig()](BTA.html#L443)):
- Kuliah (Lecture): Kumpulan Pertama (first group) = 3, Kumpulan Ulangan (repeat group) = 2, threshold 30
- Makmal (Lab): weight 2, threshold 30
- Makmal (Btech): weight 2, threshold **15** ← special case
- Tutorial: weight 1, threshold 30

**Data structure** (row object stored in `All_lecturer_record`):
```javascript
{
  recordId, helperEmail, createdAt, subject, semester, kredit, jamMinggu,
  peringkat, jenis, kumpulan, dateDisplay, week, pelajar, jamBebanCalc,
  ownerEmail, ownerMode ("l2" or "self"), verifyStatus ("Draft" | "Pending" | "Approved" | "Rejected"),
  verifyRequestId, verifyNote
}
```

## Frontend Architecture & Workflows

**Initialization** ([lines 620–2026](BTA.html#L620)):
1. Landing page (login prompt) → app shell on "Enter System"
2. Lazy load from cache (localStorage), then sync from server (if Apps Script runtime available)
3. Populate subjects dropdown from `Subjects` sheet via `syncSubjectsFromServer_()`

**Key UX workflows**:
1. **Add Row**: Form submission → `calcAll()` computes jamBeban → row added to in-memory array → rendered table
2. **Save to Cache**: `saveToCache()` writes subjects/semesters/rows to localStorage
3. **Submit for Verification**: `submitPendingForVerification()` → POST to Apps Script → `handleSubmit_()` creates approval request → email sent to L2 owner → token generated
4. **Refresh Status**: `refreshVerificationStatuses()` polls server for status changes (Approved/Rejected)
5. **Export/Import**: JSON export via File Picker API or download; import via file input, hydrate rows with defaults

**Data sync modes**:
- **Apps Script runtime mode** (`canUseAppsScriptRuntime_()`): Use `google.script.run` when embedded in Apps Script editor
- **Deployed Web App mode**: fetch POST/JSONP GET to deployed `/exec` URL
- **Fallback**: JSONP when CORS blocks fetch (mobile, old browsers)

**Client-side validation**:
- Email domain check: `isUniMAPEmail()` (must end `@unimap.edu.my`)
- Admin unlock: SHA-256 hash of admin secret (`ADMIN_SECRET_HASH`) for debugging tools
- Owner mode determination: if `ownerEmail === helperEmail`, mark as "self" (skip email approval)

## Backend Architecture & API

**Request routing** ([doGet](apps-script/Code.gs#L128), [doPost](apps-script/Code.gs#L68)):
| Action | Method | Purpose |
|--------|--------|---------|
| `submit` | POST/GET | Create pending approval request, send email |
| `upsert_row` | POST/GET | Upsert row in `All_lecturer_record` |
| `delete_row` | POST/GET | Soft-delete row (set `is_deleted=1`) |
| `statuses` | GET | Poll for approval decisions |
| `rows` | GET | Fetch all rows for a helper_email |
| `subjects` | GET | Fetch subject-to-owner mapping |
| `upsert_subject` | POST/GET | Add/update subject owner |
| `decision` | GET | Handle approval link click (email workflow) |

**Authentication & authorization**:
- `Session.getActiveUser().getEmail()` returns signed-in user (must be `@unimap.edu.my`)
- `enforceUserExecution_()` throws if user not UniMAP domain
- Approval: only the L2 owner (subject owner) can call `handleDecision_()`; token + record_id must match
- Email approval flow: link in `sendApprovalEmail_()` includes `approval_token`, passed to decision handler

**Handler lifecycle** (example: `handleSubmit_()`):
1. Validate emails (both helper and owner must be UniMAP)
2. Generate `requestId` (UUID) and `approval_token` (random hex)
3. Append row to `Requests` sheet
4. Call `sendApprovalEmail_()` with approval/reject links (GET queries with token)
5. Return `{ ok: true, request_id, message }`

**Email approval link** (from [sendApprovalEmail_](apps-script/Code.gs#L588)):
```
https://<webapp-url>?action=decision&decision=Approved&record_id=<id>&token=<token>
```
Clicking link invokes `doGet()` → `handleDecision_()` → updates status + approver email/comment in `Requests` sheet.

## Project-Specific Patterns & Conventions

**Naming**:
- `jamPelajar` = student load (per-student hour penalty for classes > threshold)
- `jamBebanCalc` = calculated total load for a row
- `verifyStatus` = approval state (Draft → Pending → Approved/Rejected)
- `L1` = helper lecturer (course instructor), `L2` = subject owner (approver)
- `ownerMode` = "l2" (needs approval) or "self" (L1 == L2, auto-approve)

**Utility functions**:
- `normalizeEmail_()` ([apps-script](apps-script/Code.gs#L745)): lowercase, trim, standard format
- `headersIndex_()`: build column index map from headers array (avoid hardcoded column numbers)
- `malaysiaNowIso_()`: timestamp in Malaysia/Kuala_Lumpur timezone (used for audit trail)
- `calcJamPelajar()`, `calcWajaranBebanSeminggu()`, `calcAll()`: pure calculation functions, no side-effects

**Error handling**:
- Try/catch in all `doGet`/`doPost` handlers; return `{ ok: false, message: "..." }`
- Validation errors thrown early with descriptive messages
- Frontend catches errors, logs to `debugLog`, shows user-friendly status messages

## Files You May Safely Edit

- **[BTA.html](BTA.html)**: Frontend logic, UI, calculations — main active work
- **[bta-data-2026-02-09.json](bta-data-2026-02-09.json)**: Sample data file (JSON import for testing)
- **[apps-script/Code.gs](apps-script/Code.gs)**: Backend logic, sheet operations, email workflow

## Do NOT Modify Without Explicit Approval

- Binary/model files (`.bin`, `.glb`, `.f3z`, `.f3d`, `.stp`) — propose alternatives instead
- Excel macros (`*.xlsm`) — request a copy for editing
- Executables or firmware — do not run or modify
- Other archived academic/hardware docs — read-only reference

## Common Agent Tasks Checklist

**To add a new API action**:
1. Add `if (action === "newAction")` branch in `doGet`/`doPost`
2. Implement handler `handleNewAction_()`, validate inputs, return `{ ok, message }`
3. Update `HEADERS` constant if new sheet columns needed
4. Test with curl (POST) or browser query (GET); verify sheet access permissions

**To modify approval flow**:
1. Review `handleSubmit_()` (create request), `sendApprovalEmail_()` (email content/links), `handleDecision_()` (validate & record)
2. Update L2 owner lookup logic if needed (currently subject_code → owner_email from `Subjects` sheet)
3. Test email delivery and token validation

**To change calculation formula**:
1. Update `calcJamPelajar()` or `getActivityConfig()` in frontend [BTA.html](BTA.html#L443)
2. Update thresholds or course weights in course classification rules
3. Test with sample rows; verify total against manual calculation
4. Clear browser cache or update `CACHE_KEY` to force refresh

**To deploy or test Web App**:
1. In Google Apps Script editor: **Deploy → New deployment → Type: Web app**
2. Execute as: **User accessing the web app**, access: **Anyone within [domain]** (or specific UniMAP accounts)
3. Copy deployment URL (`/exec`), paste into BTA.html `apiUrl` config (or auto-detect from pathname)
4. Test endpoints: `curl -X POST ... 'https://<url>/exec?action=submit&record=...'`
