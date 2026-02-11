const SHEET_NAME = "Requests";
const SPREADSHEET_ID = "1zxmp-FT6qLgLhTyWD7e0KczOOVrDFHIKudCkfMUhe0E";
const MALAYSIA_TZ = "Asia/Kuala_Lumpur";
const ALL_LECTURER_SHEET_NAME = "All_lecturer_record";
const SUBJECTS_SHEET_NAME = "Subjects";
const DEFAULT_SUBJECT_OWNER_EMAIL = "fairusahmad@unimap.edu.my";

const HEADERS = [
  "request_id",
  "record_id",
  "created_at",
  "subject_code",
  "semester",
  "kredit",
  "jam_minggu",
  "peringkat",
  "jenis",
  "kumpulan",
  "schedule",
  "date_input",
  "week",
  "bil_pelajar",
  "jam_beban",
  "helper_lecturer_email",
  "owner_lecturer_email",
  "status",
  "approval_token",
  "approver_email",
  "approver_comment",
  "approved_at",
  "decision_source"
];

const ALL_LECTURER_HEADERS = [
  "record_id",
  "helper_lecturer_email",
  "created_at",
  "updated_at",
  "subject",
  "semester",
  "kredit",
  "jam_minggu",
  "peringkat",
  "jenis",
  "kumpulan",
  "date_input",
  "date_display",
  "week",
  "pelajar",
  "owner_mode",
  "owner_email",
  "verify_status",
  "verify_request_id",
  "verify_note",
  "jam_beban_calc",
  "is_deleted"
];

const SUBJECTS_HEADERS = [
  "subject_code",
  "owner_email",
  "updated_at",
  "is_active"
];

const DEFAULT_SUBJECTS = [
  "DSC101",
  "DSC102",
  "DSC103",
  "DSC104",
  "DSC105",
  "DSC106",
  "DSC107",
  "DSC108",
  "DSC109",
  "DSC110"
];

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || "";
    let payload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch (_) {
        payload = (e && e.parameter) || {};
      }
    } else {
      payload = (e && e.parameter) || {};
    }
    const action = String(payload.action || "").toLowerCase();
    if (action === "submit") {
      return jsonOut(handleSubmit_(payload.record || {}));
    }
    if (action === "upsert_row") {
      return jsonOut(handleUpsertLecturerRow_(payload.row || {}));
    }
    if (action === "delete_row") {
      return jsonOut(handleDeleteLecturerRow_(payload.record_id || "", payload.helper_lecturer_email || ""));
    }
    if (action === "upsert_subject") {
      return jsonOut(handleUpsertSubject_(payload.subject_code || "", payload.owner_email || ""));
    }
    if (action === "decision") {
      return jsonOut(handleDecision_({
        record_id: payload.record_id,
        token: payload.token,
        decision: payload.decision,
        approver_comment: payload.approver_comment,
        decision_source: "api"
      }));
    }
    return jsonOut({ ok: false, message: "Unsupported action." });
  } catch (err) {
    return jsonOut({ ok: false, message: err.message });
  }
}

function doOptions(e) {
  // Simply returning a blank TextOutput for a doOptions request tells the
  // Apps Script environment to add the necessary CORS headers to the response.
  return ContentService.createTextOutput();
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || "").toLowerCase();

  if (action === "submit") {
    try {
      const record = parseRecordParam_(p.record);
      return jsonOrJsonp_(handleSubmit_(record), p.callback);
    } catch (err) {
      return jsonOrJsonp_({ ok: false, message: err.message }, p.callback);
    }
  }

  if (action === "statuses") {
    return jsonOrJsonp_(handleStatuses_(p), p.callback);
  }

  if (action === "rows") {
    return jsonOrJsonp_(handleLecturerRows_(p), p.callback);
  }

  if (action === "subjects") {
    return jsonOrJsonp_(handleSubjects_(), p.callback);
  }

  if (action === "upsert_subject") {
    try {
      return jsonOrJsonp_(handleUpsertSubject_(p.subject_code, p.owner_email), p.callback);
    } catch (err) {
      return jsonOrJsonp_({ ok: false, message: err.message }, p.callback);
    }
  }

  if (action === "upsert_row") {
    try {
      const row = parseRecordParam_(p.row);
      return jsonOrJsonp_(handleUpsertLecturerRow_(row), p.callback);
    } catch (err) {
      return jsonOrJsonp_({ ok: false, message: err.message }, p.callback);
    }
  }

  if (action === "delete_row") {
    try {
      return jsonOrJsonp_(handleDeleteLecturerRow_(p.record_id, p.helper_lecturer_email), p.callback);
    } catch (err) {
      return jsonOrJsonp_({ ok: false, message: err.message }, p.callback);
    }
  }

  if (action === "decision") {
    const result = handleDecision_({
      record_id: p.record_id,
      token: p.token,
      decision: p.decision,
      approver_comment: p.comment || "",
      decision_source: "email_link"
    });
    const title = result.ok ? "Decision Recorded" : "Decision Failed";
    const body = result.ok ? "Thank you. The verification decision has been saved." : "Unable to process verification request.";
    return HtmlService.createHtmlOutput(
      `<h2>${escapeHtml_(title)}</h2><p>${escapeHtml_(body)}</p><p>${escapeHtml_(result.message || "")}</p>`
    );
  }

  const t = HtmlService.createTemplateFromFile("BTA");
  const currentUserEmail = normalizeEmail_(Session.getActiveUser().getEmail());
  t.currentUserEmail = currentUserEmail;
  t.currentUserName = resolveDisplayName_(currentUserEmail);
  return t
    .evaluate()
    .setTitle("Jam Beban Calculator (Pengajaran)");
}

function apiGetLecturerRows(helperEmail) {
  try {
    return handleLecturerRows_({ helper_email: helperEmail });
  } catch (err) {
    return { ok: false, message: err.message, items: [] };
  }
}

function apiUpsertLecturerRow(row) {
  try {
    return handleUpsertLecturerRow_(row || {});
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function apiDeleteLecturerRow(recordId, helperEmail) {
  try {
    return handleDeleteLecturerRow_(recordId || "", helperEmail || "");
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function apiSubmitVerifyRecord(record) {
  try {
    return handleSubmit_(record || {});
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function apiGetStatuses(recordIdsCsv) {
  try {
    return handleStatuses_({ record_ids: String(recordIdsCsv || "") });
  } catch (err) {
    return { ok: false, message: err.message, items: [] };
  }
}

function apiGetSubjects() {
  try {
    return handleSubjects_();
  } catch (err) {
    return { ok: false, message: err.message, items: [] };
  }
}

function apiUpsertSubject(subjectCode, ownerEmail) {
  try {
    return handleUpsertSubject_(subjectCode, ownerEmail);
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function handleStatuses_(params) {
  const csv = String(params.record_ids || "");
  const recordIds = csv
    .split(",")
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (!recordIds.length) {
    return { ok: true, items: [] };
  }

  const target = {};
  recordIds.forEach((id) => { target[id] = true; });

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, items: [] };

  const indexMap = headersIndex_(values[0]);
  const recordCol = indexMap.record_id;
  const statusCol = indexMap.status;
  const approverCol = indexMap.approver_email;
  const commentCol = indexMap.approver_comment;
  const approvedAtCol = indexMap.approved_at;

  const items = [];
  for (let r = 1; r < values.length; r++) {
    const rec = String(values[r][recordCol] || "");
    if (!target[rec]) continue;
    items.push({
      record_id: rec,
      status: String(values[r][statusCol] || "Draft"),
      approver_email: String(values[r][approverCol] || ""),
      approver_comment: String(values[r][commentCol] || ""),
      approved_at: String(values[r][approvedAtCol] || "")
    });
  }

  return { ok: true, items: items };
}

function handleSubjects_() {
  const sh = getSubjectsSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, items: [] };
  const idx = headersIndex_(values[0]);
  const items = [];
  for (let r = 1; r < values.length; r++) {
    const subjectCode = String(values[r][idx.subject_code] || "").trim();
    const ownerEmail = normalizeEmail_(values[r][idx.owner_email]);
    const isActive = String(values[r][idx.is_active] || "1").toLowerCase();
    if (!subjectCode) continue;
    if (isActive === "0" || isActive === "false" || isActive === "no") continue;
    items.push({
      subject_code: subjectCode,
      owner_email: ownerEmail
    });
  }
  return { ok: true, items: items };
}

function handleUpsertSubject_(subjectCodeRaw, ownerEmailRaw) {
  const subjectCode = String(subjectCodeRaw || "").trim().toUpperCase();
  const ownerEmail = normalizeEmail_(ownerEmailRaw || DEFAULT_SUBJECT_OWNER_EMAIL);
  if (!subjectCode) throw new Error("Missing subject_code.");
  if (!isUniMapEmail_(ownerEmail)) throw new Error("Invalid owner_email.");
  enforceUniMapUser_();

  const sh = getSubjectsSheet_();
  const values = sh.getDataRange().getValues();
  const idx = headersIndex_(values[0]);
  let rowNo = -1;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idx.subject_code] || "").trim().toUpperCase() === subjectCode) {
      rowNo = r + 1;
      break;
    }
  }

  const payload = {
    subject_code: subjectCode,
    owner_email: ownerEmail,
    updated_at: malaysiaNowIso_(),
    is_active: "1"
  };

  if (rowNo < 2) {
    sh.appendRow(SUBJECTS_HEADERS.map((k) => payload[k]));
  } else {
    sh.getRange(rowNo, 1, 1, SUBJECTS_HEADERS.length).setValues([SUBJECTS_HEADERS.map((k) => payload[k])]);
  }

  return { ok: true, subject_code: subjectCode, owner_email: ownerEmail };
}

function parseRecordParam_(raw) {
  const text = String(raw || "").trim();
  if (!text) return {};
  return JSON.parse(text);
}

function handleLecturerRows_(params) {
  const helperEmail = normalizeEmail_(params.helper_email);
  if (!isUniMapEmail_(helperEmail)) {
    return { ok: false, message: "Invalid helper_email.", items: [] };
  }

  const sh = getAllLecturerSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, items: [] };

  const idx = headersIndex_(values[0]);
  const out = [];

  for (let r = 1; r < values.length; r++) {
    const rowHelper = normalizeEmail_(values[r][idx.helper_lecturer_email]);
    if (rowHelper !== helperEmail) continue;
    const deleted = String(values[r][idx.is_deleted] || "").toLowerCase();
    if (deleted === "1" || deleted === "true" || deleted === "yes") continue;

    out.push({
      recordId: String(values[r][idx.record_id] || ""),
      subject: String(values[r][idx.subject] || ""),
      semester: String(values[r][idx.semester] || ""),
      kredit: Number(values[r][idx.kredit] || 0),
      jamMinggu: Number(values[r][idx.jam_minggu] || 0),
      peringkat: String(values[r][idx.peringkat] || ""),
      jenis: String(values[r][idx.jenis] || ""),
      kumpulan: String(values[r][idx.kumpulan] || ""),
      dateInput: String(values[r][idx.date_input] || ""),
      dateDisplay: String(values[r][idx.date_display] || ""),
      week: Number(values[r][idx.week] || 1),
      pelajar: Number(values[r][idx.pelajar] || 0),
      helperEmail: rowHelper,
      ownerMode: String(values[r][idx.owner_mode] || "l2"),
      ownerEmail: normalizeEmail_(values[r][idx.owner_email]),
      verifyStatus: String(values[r][idx.verify_status] || "Draft"),
      verifyRequestId: String(values[r][idx.verify_request_id] || ""),
      verifyNote: String(values[r][idx.verify_note] || ""),
      jamBebanCalc: Number(values[r][idx.jam_beban_calc] || 0),
      createdAt: String(values[r][idx.created_at] || malaysiaNowIso_()),
      minggu: 1
    });
  }

  return { ok: true, items: out };
}

function handleUpsertLecturerRow_(row) {
  const helperEmail = normalizeEmail_(row.helperEmail || row.helper_lecturer_email);
  if (!isUniMapEmail_(helperEmail)) throw new Error("Invalid helperEmail.");
  enforceUserExecution_(helperEmail);

  const recordId = String(row.recordId || row.record_id || Utilities.getUuid());
  const ownerEmail = normalizeEmail_(row.ownerEmail || row.owner_email);
  const ownerMode = String(row.ownerMode || row.owner_mode || "l2");
  if (ownerMode !== "self" && !isUniMapEmail_(ownerEmail)) {
    throw new Error("Invalid ownerEmail.");
  }

  const sh = getAllLecturerSheet_();
  const values = sh.getDataRange().getValues();
  const idx = headersIndex_(values[0]);
  let rowNo = -1;
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idx.record_id] || "") === recordId &&
        normalizeEmail_(values[r][idx.helper_lecturer_email]) === helperEmail) {
      rowNo = r + 1;
      break;
    }
  }

  const createdAt = normalizeMalaysiaIso_(row.createdAt || row.created_at, malaysiaNowIso_());
  const payload = {
    record_id: recordId,
    helper_lecturer_email: helperEmail,
    created_at: createdAt,
    updated_at: malaysiaNowIso_(),
    subject: String(row.subject || ""),
    semester: String(row.semester || ""),
    kredit: Number(row.kredit || 0),
    jam_minggu: Number(row.jamMinggu || row.jam_minggu || 0),
    peringkat: String(row.peringkat || ""),
    jenis: String(row.jenis || ""),
    kumpulan: String(row.kumpulan || ""),
    date_input: String(row.dateInput || row.date_input || ""),
    date_display: String(row.dateDisplay || row.date_display || ""),
    week: Number(row.week || 1),
    pelajar: Number(row.pelajar || 0),
    owner_mode: ownerMode,
    owner_email: ownerEmail,
    verify_status: String(row.verifyStatus || row.verify_status || "Draft"),
    verify_request_id: String(row.verifyRequestId || row.verify_request_id || ""),
    verify_note: String(row.verifyNote || row.verify_note || ""),
    jam_beban_calc: Number(row.jamBebanCalc || row.jam_beban_calc || 0),
    is_deleted: "0"
  };

  if (rowNo < 2) {
    sh.appendRow(ALL_LECTURER_HEADERS.map((k) => payload[k]));
  } else {
    sh.getRange(rowNo, 1, 1, ALL_LECTURER_HEADERS.length).setValues([ALL_LECTURER_HEADERS.map((k) => payload[k])]);
  }

  return { ok: true, record_id: recordId };
}

function handleDeleteLecturerRow_(recordIdRaw, helperEmailRaw) {
  const recordId = String(recordIdRaw || "");
  const helperEmail = normalizeEmail_(helperEmailRaw);
  if (!recordId) throw new Error("Missing record_id.");
  if (!isUniMapEmail_(helperEmail)) throw new Error("Invalid helper email.");
  enforceUserExecution_(helperEmail);

  const sh = getAllLecturerSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, message: "Nothing to delete." };
  const idx = headersIndex_(values[0]);

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idx.record_id] || "") === recordId &&
        normalizeEmail_(values[r][idx.helper_lecturer_email]) === helperEmail) {
      sh.getRange(r + 1, idx.is_deleted + 1).setValue("1");
      sh.getRange(r + 1, idx.updated_at + 1).setValue(malaysiaNowIso_());
      return { ok: true, record_id: recordId };
    }
  }

  return { ok: true, message: "Record not found." };
}

function handleSubmit_(record) {
  const helperEmail = normalizeEmail_(record.helper_lecturer_email);
  const ownerEmail = normalizeEmail_(record.owner_lecturer_email);
  if (!isUniMapEmail_(helperEmail)) throw new Error("Invalid helper_lecturer_email.");
  if (!isUniMapEmail_(ownerEmail)) throw new Error("Invalid owner_lecturer_email.");
  enforceUserExecution_(helperEmail);

  const requestId = Utilities.getUuid();
  const token = Utilities.getUuid().replace(/-/g, "");
  const nowMy = malaysiaNowIso_();
  const sheet = getSheet_();

  const row = {
    request_id: requestId,
    record_id: String(record.record_id || Utilities.getUuid()),
    created_at: normalizeMalaysiaIso_(record.created_at, nowMy),
    subject_code: String(record.subject_code || ""),
    semester: String(record.semester || ""),
    kredit: Number(record.kredit || 0),
    jam_minggu: Number(record.jam_minggu || 0),
    peringkat: String(record.peringkat || ""),
    jenis: String(record.jenis || ""),
    kumpulan: String(record.kumpulan || ""),
    schedule: String(record.schedule || ""),
    date_input: String(record.date_input || ""),
    week: String(record.week || ""),
    bil_pelajar: Number(record.bil_pelajar || 0),
    jam_beban: Number(record.jam_beban || 0),
    helper_lecturer_email: helperEmail,
    owner_lecturer_email: ownerEmail,
    status: "Pending",
    approval_token: token,
    approver_email: "",
    approver_comment: "",
    approved_at: "",
    decision_source: ""
  };

  sheet.appendRow(HEADERS.map((k) => row[k]));
  sendApprovalEmail_(row);

  return {
    ok: true,
    request_id: requestId,
    message: `Pending verification email sent to ${ownerEmail}.`
  };
}

function handleDecision_(input) {
  const recordId = String(input.record_id || "");
  const token = String(input.token || "");
  const decision = normalizeDecision_(input.decision);
  const comment = String(input.approver_comment || "");
  if (!recordId || !token) throw new Error("Missing record_id or token.");
  if (!decision) throw new Error("Decision must be Approved or Rejected.");

  const approverEmail = normalizeEmail_(Session.getActiveUser().getEmail());
  if (!isUniMapEmail_(approverEmail)) {
    throw new Error("Approval requires signed-in UniMAP account.");
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error("No pending requests found.");

  const indexMap = headersIndex_(values[0]);
  const recordCol = indexMap.record_id;
  const tokenCol = indexMap.approval_token;
  const ownerCol = indexMap.owner_lecturer_email;
  const statusCol = indexMap.status;
  const approverCol = indexMap.approver_email;
  const commentCol = indexMap.approver_comment;
  const approvedAtCol = indexMap.approved_at;
  const sourceCol = indexMap.decision_source;

  let rowNumber = -1;
  for (let r = 1; r < values.length; r++) {
    const rec = String(values[r][recordCol] || "");
    const tok = String(values[r][tokenCol] || "");
    if (rec === recordId && tok === token) {
      rowNumber = r + 1;
      break;
    }
  }
  if (rowNumber < 2) throw new Error("Request not found or token mismatch.");

  const ownerEmail = normalizeEmail_(sheet.getRange(rowNumber, ownerCol + 1).getValue());
  if (ownerEmail !== approverEmail) {
    throw new Error("Only the subject owner (L2) can approve/reject this request.");
  }

  const currentStatus = String(sheet.getRange(rowNumber, statusCol + 1).getValue() || "");
  if (currentStatus === "Approved" || currentStatus === "Rejected") {
    return { ok: true, message: `Already ${currentStatus}.` };
  }

  sheet.getRange(rowNumber, statusCol + 1).setValue(decision);
  sheet.getRange(rowNumber, approverCol + 1).setValue(approverEmail);
  sheet.getRange(rowNumber, commentCol + 1).setValue(comment);
  sheet.getRange(rowNumber, approvedAtCol + 1).setValue(malaysiaNowIso_());
  sheet.getRange(rowNumber, sourceCol + 1).setValue(String(input.decision_source || "api"));

  return { ok: true, message: `Request ${recordId} marked as ${decision}.` };
}

function sendApprovalEmail_(row) {
  const appUrl = ScriptApp.getService().getUrl();
  const qs = `record_id=${encodeURIComponent(row.record_id)}&token=${encodeURIComponent(row.approval_token)}`;
  const approveLink = `${appUrl}?action=decision&decision=Approved&${qs}`;
  const rejectLink = `${appUrl}?action=decision&decision=Rejected&${qs}`;

  const subject = `[UniMAP] Verification required: ${row.subject_code}`;
  const body = [
    `Dear subject owner (${row.owner_lecturer_email}),`,
    "",
    `A teaching assistance entry was submitted by ${row.helper_lecturer_email}.`,
    `Subject: ${row.subject_code}`,
    `Type: ${row.jenis}`,
    `Schedule: ${row.schedule}`,
    "",
    `Approve: ${approveLink}`,
    `Reject: ${rejectLink}`,
    "",
    "This email is generated by the UniMAP teaching load tool."
  ].join("\n");

  MailApp.sendEmail({
    to: row.owner_lecturer_email,
    subject: subject,
    body: body
  });
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.setSpreadsheetTimeZone(MALAYSIA_TZ);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function getAllLecturerSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.setSpreadsheetTimeZone(MALAYSIA_TZ);
  let sh = ss.getSheetByName(ALL_LECTURER_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(ALL_LECTURER_SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(ALL_LECTURER_HEADERS);
  return sh;
}

function getSubjectsSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.setSpreadsheetTimeZone(MALAYSIA_TZ);
  let sh = ss.getSheetByName(SUBJECTS_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SUBJECTS_SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(SUBJECTS_HEADERS);

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    const now = malaysiaNowIso_();
    const rows = DEFAULT_SUBJECTS.map((code) => [
      code,
      DEFAULT_SUBJECT_OWNER_EMAIL,
      now,
      "1"
    ]);
    if (rows.length) {
      sh.getRange(2, 1, rows.length, SUBJECTS_HEADERS.length).setValues(rows);
    }
  }
  return sh;
}

function malaysiaNowIso_() {
  return Utilities.formatDate(new Date(), MALAYSIA_TZ, "yyyy-MM-dd'T'HH:mm:ss") + "+08:00";
}

function normalizeMalaysiaIso_(value, fallbackIso) {
  const text = String(value || "").trim();
  if (!text) return String(fallbackIso || malaysiaNowIso_());
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return String(fallbackIso || malaysiaNowIso_());
  return Utilities.formatDate(parsed, MALAYSIA_TZ, "yyyy-MM-dd'T'HH:mm:ss") + "+08:00";
}

function enforceUserExecution_(expectedEmail) {
  const activeEmail = normalizeEmail_(Session.getActiveUser().getEmail());
  const effectiveEmail = normalizeEmail_(Session.getEffectiveUser().getEmail());

  if (!isUniMapEmail_(activeEmail)) {
    throw new Error("Submit requires signed-in UniMAP account.");
  }
  if (activeEmail !== expectedEmail) {
    throw new Error("Submit using the same UniMAP account as helper_lecturer_email.");
  }
  if (!effectiveEmail || activeEmail !== effectiveEmail) {
    throw new Error("Deploy Web App with Execute as: User accessing the web app.");
  }
}

function enforceUniMapUser_() {
  const activeEmail = normalizeEmail_(Session.getActiveUser().getEmail());
  if (!isUniMapEmail_(activeEmail)) {
    throw new Error("Action requires signed-in UniMAP account.");
  }
}

function headersIndex_(headerRow) {
  const idx = {};
  for (let i = 0; i < headerRow.length; i++) {
    idx[String(headerRow[i])] = i;
  }
  return idx;
}

function normalizeDecision_(decision) {
  const d = String(decision || "").toLowerCase();
  if (d === "approved") return "Approved";
  if (d === "rejected") return "Rejected";
  return "";
}

function isUniMapEmail_(email) {
  return /^[a-z0-9._%+-]+@unimap\.edu\.my$/i.test(String(email || ""));
}

function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function resolveDisplayName_(email) {
  const normalized = normalizeEmail_(email);
  if (!normalized) return "";

  // 1. Try AdminDirectory (Directory API) - Best for official names in Workspace
  // Requires "Admin SDK API" service enabled in Apps Script editor.
  try {
    if (typeof AdminDirectory !== "undefined" && AdminDirectory.Users && AdminDirectory.Users.get) {
      // viewType: 'domain_public' allows regular users to fetch profile info
      const user = AdminDirectory.Users.get(normalized, { viewType: 'domain_public' });
      const fullName = String(user && user.name && user.name.fullName || "").trim();
      if (fullName) return fullName;
    }
  } catch (_) {
    // AdminDirectory failed or not enabled
  }

  // 2. Try People API (people/me) - For the current user's profile
  // Requires "People API" service enabled in Apps Script editor.
  try {
    if (typeof People !== "undefined" && People.People && People.People.get) {
      const me = People.People.get("people/me", { personFields: "names" });
      const names = (me && me.names) || [];
      for (var i = 0; i < names.length; i++) {
        var n = names[i];
        if (n && n.metadata && n.metadata.primary && String(n.displayName || "").trim()) {
          return String(n.displayName || "").trim();
        }
      }
      if (names.length && String(names[0].displayName || "").trim()) {
        return String(names[0].displayName || "").trim();
      }
    }
  } catch (_) {
    // People API failed or not enabled
  }

  return fallbackNameFromEmail_(normalized);
}

function fallbackNameFromEmail_(email) {
  const local = normalizeEmail_(email).split("@")[0] || "";
  return local
    .split(/[._+-]+/)
    .filter(Boolean)
    .map(function(part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonp_(obj, callbackName) {
  const cb = String(callbackName || "").trim();
  if (!cb) return jsonOut(obj);
  if (!/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(cb)) {
    return jsonOut({ ok: false, message: "Invalid callback name." });
  }
  return ContentService
    .createTextOutput(`${cb}(${JSON.stringify(obj)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function escapeHtml_(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
