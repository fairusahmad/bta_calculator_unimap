# BTA Calculator UniMAP

Web app + Google Apps Script backend for calculating and verifying `Jam Beban Pengajaran` (teaching load) at UniMAP.

## What this project does

- Calculates teaching load (`Jam Beban`) per row using course/activity inputs.
- Stores lecturer rows in Google Sheets (`All_lecturer_record`).
- Submits rows for owner verification (L2) and tracks statuses (`Draft`, `Pending`, `Approved`, `Rejected`).
- Sends approval/rejection links to subject owners by email.
- Shows grouped summary and approved-progress against a target (default `448`).

## Core formula

- `JumPelajar = max(0, BilPelajar - T) x 0.033`
- `Nilai Beban = (Jam Pertemuan x Wajaran x Bil. Minggu) + (JumPelajar x Bil. Minggu)`

Where threshold `T` is:
- `30` (default)
- `15` for `Makmal (Btech)/Program Teknologi`

## Project structure

- `BTA.html`: frontend UI + calculator logic + sync/submit actions.
- `apps-script/code.gs`: Apps Script backend (Web App endpoints + Sheets + email workflow).
- `README.md`: this document.

## Data sheets used

The backend auto-creates these tabs in the configured spreadsheet:

- `Requests`: verification requests and decisions.
- `All_lecturer_record`: per-lecturer working records.
- `Subjects`: subject code to owner-email mapping.

## Configuration (important)

Edit `apps-script/code.gs`:

- `SPREADSHEET_ID`: set to your target Google Sheet ID.
- `DEFAULT_SUBJECT_OWNER_EMAIL`: fallback owner for default subjects.
- `DEFAULT_SUBJECTS`: starter subject codes list.

Also review in `BTA.html`:

- `ADMIN_SECRET_HASH` and admin fallback code (`BTA-ADMIN-2026`) used for admin panel unlock.

## Deployment (Google Apps Script)

1. Create/open an Apps Script project.
2. Add/update files:
   - `Code.gs` from `apps-script/code.gs`
   - `BTA.html` from repo root
3. Enable required Google services if needed:
   - Optional: Admin SDK (`AdminDirectory`) and People API (`People`) for display-name lookup.
4. Deploy as **Web App**:
   - Execute as: `User accessing the web app`
   - Access: your UniMAP org users (or appropriate domain policy)
5. Open the deployed `/exec` URL and use the app there.

Notes:
- The frontend expects a deployed `/exec` runtime for API calls.
- User account must be signed in with valid `@unimap.edu.my` email to submit/approve.

## Backend actions (API)

Main actions handled by `doGet/doPost`:

- `subjects`: list active subjects.
- `upsert_subject`: add/update subject owner mapping.
- `rows`: list lecturer rows.
- `upsert_row`: create/update lecturer row.
- `delete_row`: soft-delete lecturer row.
- `submit`: submit verification request (emails owner).
- `statuses`: fetch decision statuses.
- `decision`: approve/reject a request by tokenized link.

## Security and behavior notes

- Approval decision is restricted to the mapped owner (`L2`) account.
- Enforces helper email and active signed-in account match (`enforceUserExecution_`).
- Rows are soft-deleted (`is_deleted = 1`) in `All_lecturer_record`.
- Local browser cache is used for some UX state; server sheets are source of truth.
