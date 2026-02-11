# Copilot Instructions for BTA Teaching Load Calculator

## Architecture Overview

This is a **Google Apps Script + Google Sheets** backend for a two-level approval workflow:
- **L1 (Lecturer)** submits teaching load records via `BTA.html` frontend
- **L2 (Subject Owner)** receives email and approves/rejects via action links
- All persistence is in Google Sheets with three key tabs: `Requests`, `All_lecturer_record`, `Subjects`

**Key Files:**
- [apps-script/Code.gs](../apps-script/Code.gs) — Web App endpoints, sheet CRUD, email dispatch (792 lines)
- [BTA.html](../BTA.html) — Frontend form & status polling (2026 lines)
- [README.md](../README.md) — API spec and setup instructions

## API Routing Pattern

The backend uses a **dispatcher pattern** in `doPost()`/`doGet()`:

**Available actions** (query param `?action=`):
| Action | Method | Handler | Purpose |
|--------|--------|---------|---------|
| `submit` | POST/GET | `handleSubmit_()` | L1 submits record for approval |
| `decision` | GET | `handleDecision_()` | L2 approves/rejects via email link |
| `statuses` | GET | `handleStatuses_()` | Poll approval status by `record_ids` |
| `rows` | GET | `handleLecturerRows_()` | Fetch cached lecturer records |
| `subjects` | GET | `handleSubjects_()` | List registered subjects |
| `upsert_row` | POST/GET | `handleUpsertLecturerRow_()` | Save draft to All_lecturer_record |
| `delete_row` | POST/GET | `handleDeleteLecturerRow_()` | Soft-delete (set `is_deleted=1`) |
| `upsert_subject` | POST/GET | `handleUpsertSubject_()` | Register/update subject owner |

**Pattern for new actions:**
```javascript
// In doPost/doGet, add this branch:
if (action === "myaction") {
  return jsonOut(handleMyAction_(payload));
}

// Then implement private handler:
function handleMyAction_(input) {
  enforceUniMapUser_(); // add auth if needed
  // ... logic ...
  return { ok: true, data: result };
}

// Optionally expose as public API:
function apiMyAction(input) {
  try { return handleMyAction_(input); }
  catch(err) { return { ok: false, message: err.message }; }
}
```

## Core Data Flows

### 1. Submit a Record (L1 Action)
**Entry Point:** `handleSubmit_(record)` → appends row to `Requests` sheet
- Generates `request_id` (UUID) and `approval_token` (token for link-click verification)
- Sets status to `"Pending"`, owner_email to L2 recipient
- Immediately calls `sendApprovalEmail_()` with Approve/Reject links
- Links embed `record_id` and `token` for replay-attack prevention

**API Endpoints:**
- `POST/GET ?action=submit&record={...}` — HTTP trigger
- Direct call: `apiSubmitVerifyRecord(record)` (from embedded HTML preview)

### 2. Approve/Reject Decision (L2 Action)
**Entry Point:** `handleDecision_()` — triggered by email link click
1. Verifies `record_id` + `token` match (lookup in `Requests` sheet)
2. Enforces L2 ownership: only `owner_lecturer_email` can decide
3. Checks idempotency: prevents double-approval (status already "Approved"/"Rejected")
4. Updates row: `status`, `approver_email`, `approver_comment`, `approved_at`, `decision_source`

**Decision sources:** `"api"` (POST/GET call) or `"email_link"` (clicked link)

### 3. Frontend Polling (L1 Status Check)
`refreshVerificationStatuses()` polls `?action=statuses&record_ids=id1,id2,...` every few seconds
- Returns array with `status`, `approver_email`, `approver_comment`, `approved_at`

### 4. L1 Local Caching
`?action=upsert_row` / `?action=delete_row` — Frontend caches rows in `All_lecturer_record` sheet
- Soft deletes only: `is_deleted` flag set to "1"
- Updates `updated_at` timestamp on every change

## Critical Conventions

### Email Validation
- **UniMAP domain check:** `isUniMapEmail_(email)` regex: `/^[a-z0-9._%+-]+@unimap\.edu\.my$/i`
- All endpoints enforce `Session.getActiveUser()` auth + UniMAP domain
- Deployment must use **Execute as: User accessing the web app** (not service account)

### Timezone Handling
- **All timestamps:** Asia/Kuala_Lumpur (Malaysia) with `+08:00` ISO offset
- Helper: `malaysiaNowIso_()` — returns formatted date string
- Parser: `normalizeMalaysiaIso_(value, fallback)` — coerces to Malaysia timezone

### Header Mapping Pattern
All sheets use `headersIndex_(headerRow)` to build column index object:
```javascript
const idx = headersIndex_(values[0]);
const col = idx.record_id; // get column number
sheet.getRange(rowNum, col + 1).getValue(); // access by name
```
**Why:** Defensive against column reordering; sheet operations are 1-indexed

### Error Handling
- All handler functions throw errors (not return `{ok: false}`)
- `doPost()`/`doGet()` catch and wrap in JSON response
- Common errors: missing auth, wrong UniMAP account, invalid subject owner

## Sheet Structure Reference

**Requests sheet** (approval records):
- `request_id`, `record_id`, `created_at`, `subject_code`, ..., `approval_token`, `status` ("Pending"/"Approved"/"Rejected"), `approver_email`, `approved_at`

**All_lecturer_record sheet** (L1 cached records):
- `record_id`, `helper_lecturer_email`, `created_at`, `updated_at`, `subject`, ..., `verify_status`, `verify_request_id`, `is_deleted`

**Subjects sheet** (subject → L2 mapping):
- `subject_code`, `owner_email`, `updated_at`, `is_active` (default: "1")

## Common Agent Tasks Checklist

- **Adding a new field:** 
  1. Add to relevant `HEADERS` const (e.g., HEADERS or ALL_LECTURER_HEADERS)
  2. Add to row construction in handler (e.g., `handleSubmit_()`)
  3. Update both frontend input AND sheet row mapping
- **Changing approval logic:** Edit `handleDecision_()` — verify role checks & idempotency guard (status already decided = return early)
- **Adding email feature:** Remember `escapeHtml_()` for body content + timezone conversion via `malaysiaNowIso_()`
- **Adding new sheet action:** 
  1. Add `if (action === "newaction")` branch in both `doPost()` and `doGet()`
  2. Implement handler (private, ending with `_()`)
  3. Add corresponding API wrapper (public, `apiNewAction()`)
- **Testing without deployment:** 
  - Use `/dev` preview mode in Apps Script editor
  - Direct call: `apiSubmitVerifyRecord(record)` from console
  - Check sheet directly via SpreadsheetApp UI
- **Debugging sheet queries:** Use `getDataRange().getValues()` loop pattern; avoid batch SpreadsheetApp operations if values already in memory

## Frontend Calculation Logic (BTA.html)

The load calculation uses **activity-based coefficients** and **student thresholds**:

### Key Functions in Calculation Flow
- `getActivityConfig({jenis, kumpulan})` — maps activity type + group to coefficient + threshold
  - **Kuliah** (Lecture): coeff=3 (first group) or 2 (repeat), threshold=30
  - **Makmal** (Lab): coeff=2, threshold=30 (or 15 for Btech variant)
  - **Tutorial**: coeff=1, threshold=30
- `calcJamPelajar(bilanganPelajar, threshold)` — returns `max(0, students - threshold) × 0.033`
- `calcAll()` — combines: `(hourly_meeting × coefficient × weeks) + (student_hours × weeks)`

### Critical Pattern: String Parsing
- Input format: `"3 - Makmal (Btech)"` → functions parse via `startsWith()` or `includesCI()` (case-insensitive)
- Always use regex `^(\d+)\s*-` to extract numeric prefix safely
- Example: `"2 - Kumpulan Ulangan"` → detects group type via substring matching

### Frontend State Management
- Local arrays: `subjects[]` (dropdown pool), `rows[]` (calculation table entries)
- `render()` rebuilds table & totals; `updateProgressBar()` recolors green→orange→red
- Export/import via JSON for offline persistence (`bta-data-YYYY-MM-DD.json`)

## Backend → Frontend Contract

**Two parallel data layers:**
- **Requests sheet** (L1 submission → L2 approval) — full audit trail
- **All_lecturer_record sheet** (L1 draft cache) — soft-deletes only, never hard-delete

**Frontend polling cycle:**
1. User adds rows locally in `rows[]`
2. `Save Data` → upserts to `All_lecturer_record` per `record_id` + `helper_lecturer_email`
3. "Verify" button → POST to `?action=submit` → creates `Requests` entry
4. Every 3s, poll `?action=statuses` to show live approval status badge

## Configuration & Defaults

### Spreadsheet Setup
- **SPREADSHEET_ID** (line 2): must be set before deployment
- **DEFAULT_SUBJECTS** (lines 56–65): initialized if Subjects sheet empty
- **DEFAULT_SUBJECT_OWNER_EMAIL**: fallback if subject not found in Subjects sheet

### Subject Management Pattern
`handleUpsertSubject_()` is idempotent: upserts by `subject_code`, never duplicates.
Used by L2 admin to register new subjects and assign owners; frontend fetches via `?action=subjects`.

## Known Limitations

- No built-in audit log (decisions not tracked separately from status update)
- CORS blocks `file://` BTA.html; must host on web server or embed in Apps Script
- Subject owners lazy-loaded via AdminDirectory/People API (fallback to email parsing)
- Calculation rules (thresholds, coefficients) are split between frontend logic and backend row construction
- Frontend stores `jam_beban_calc` in All_lecturer_record but Requests sheet stores raw `jam_beban` number
