# Copilot instructions for this workspace

This is a mixed archive of academic documents, CAD/3D assets, hardware firmware, and **one active web application** ([BTA.html](BTA.html)). The workspace is primarily user artifacts with one actively developed codebase — a teaching load calculator for Malaysian academic institutions.

## Active Codebase: BTA (Beban Tugas Akademik) Calculator

**What it is**: Single-file HTML/JavaScript application that calculates teaching load hours based on course type, student count, class group, and duration.

**Key features**:
- Course registration and load calculation following Malaysian academic standards
- Dynamic table with real-time calculations using KaTeX math rendering
- Progress bar tracking against configurable target (default: 60 hours)
- Data persistence: JSON import/export for calculations
- **Calculation model**: Two formulas baked into the app:
  - Student load (jamPelajar): max(0, student_count - threshold) × 0.033 where threshold varies by course type (30 for most, 15 for tech labs)
  - Total load: (hours_weekly × course_weight × weeks) + (jamPelajar × weeks)

**Course classification rules** (in getActivityConfig() function):
- **Kuliah (Lecture)**: weight 3 (kumpulan pertama), 2 (kumpulan ulangan), threshold 30
- **Makmal (Lab)**: weight 2, threshold 30; **Makmal Program Teknologi**: threshold 15
- **Tutorial**: weight 1, threshold 30

**Data format**: [bta-data-2026-02-09.json](bta-data-2026-02-09.json) follows structure with subjects[] and ows[] (each row = one course entry with calculations).

**Development patterns**:
- DOM elements cached in els object (efficiency, not vanilla framework)
- State stored in ows array; render after mutations
- Validation logic in eadInputs() catches empty/invalid inputs before adding to table
- Client-side only — no backend; all calculations in JavaScript

## Workspace Structure & Conventions

**Safe operations without confirmation**:
- Edit [BTA.html](BTA.html) and [bta-data-2026-02-09.json](bta-data-2026-02-09.json) — these are active development files
- Propose UI/UX improvements, formula corrections, or feature additions to BTA
- Extract text/data from PDFs and CAD files for summaries

**Restricted without user approval**:
- **Do not run** .exe files: ChatGPT Installer.exe, Fusion Client Downloader.exe, AltiumDesignerSetup_26_2_0.exe, eDrawingsFullAllX64.exe, QuestaSetup-25.3.1.100-windows.exe, VSCodeUserSetup-x64-1.108.2.exe — all third-party installers
- **Do not edit in-place**: .xlsm files, .f3d/.stp CAD files, .pdf documents — propose copies or extraction instead
- **Do not modify**: esp8266/ firmware blobs (.bin) or binary model files (.glb, .f3z)

**When to ask clarification**:
- If user says "improve the project" — confirm they mean [BTA.html](BTA.html) (the only active code) vs archive operations
- Before converting CAD files: always list recommended open-source tools (e.g., FreeCAD for .f3d/.stp)
- If editing spreadsheet macros: ask whether to work on original or a versioned copy

## File Organization Reference

| Category | Key Files | Note |
|----------|-----------|------|
| **Active app** | [BTA.html](BTA.html), [bta-data-2026-02-09.json](bta-data-2026-02-09.json) | Single-page calculator; vanilla JS |
| **UI assets** | [IEEE - Application_files](IEEE%20-%20Application_files/) | Cloned web assets (CSS, JS bundles); safe to inspect |
| **Spreadsheets** | BTA Calculator V*.xlsm | Excel with macros; preserve originals if making changes |
| **CAD/3D** | *.f3d, *.stp, *.f3z | Read-only unless explicit conversion request |
| **Firmware** | [esp8266/](esp8266/) | Reference only; contains 3D scene files |
| **Documents** | *.pdf, .docx, .tex | Archive; extract text on request |
