# Master Data and VL import

The recruiter selectors read active values from the organization Master Data catalog. The API also registers new vacancy skills when position requirements are saved, so a skill entered in a vacancy is available for later matching and editing.

## Seed V1 selectors

Run against a local or test database only. The command is dry-run by default and never deletes records.

```powershell
node scripts/seed-v1-master-data.cjs --organization-id <ORG_UUID> --apply
```

This seeds Candidate Sources and the five API-compatible Interview Types. Existing values are matched by stable code/name, reactivated when necessary, and left unchanged when already current.

## Import Departments and Job Titles

Preview the workbook first:

```powershell
node scripts/import-vl-master-data.cjs --workbook "D:\Manpower\VL.xlsx"
```

Apply the preview to one local/test organization:

```powershell
node scripts/import-vl-master-data.cjs --workbook "D:\Manpower\VL.xlsx" --organization-id <ORG_UUID> --apply
```

Only the `Rowdata` sheet is imported by default. The importer normalizes spreadsheet whitespace, applies a small typo/casing map, de-duplicates departments and titles case-insensitively, links each title to its department through position metadata, and preserves existing records. Pass `--include-uae` to include the `UAE VL ` sheet after reviewing it, or pass `--include-hiring` only when the additional hiring sheets have been reviewed.

The web **Bulk Import Center → Positions** flow accepts the original `Rowdata` headers (`Position`, `Department Name`, `Level`, `Entity`, and `Type`). A missing department is created in the Departments catalog during confirmation, and an existing title is shown as a duplicate for an Update/Skip decision. Re-uploading the same sheet therefore reuses the existing position and department records.

Both commands require `DATABASE_URL` in the repository `.env`. Do not run `--apply` against production until the preview and organization ID have been reviewed.
