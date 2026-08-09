"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrations = path.join(__dirname, "..", "supabase", "migrations");
const entries = fs.readFileSync(path.join(migrations, "20260808_create_study_entries.sql"), "utf8");
const checks = fs.readFileSync(path.join(migrations, "20260809_create_milestone_checks.sql"), "utf8");
const normalization = fs.readFileSync(path.join(migrations, "20260809_normalize_study_entries_rls.sql"), "utf8");

for (const [name, sql] of [["study_entries", entries], ["milestone_checks", checks]]) {
  assert.match(sql, /enable row level security/i, `${name} enables RLS`);
  assert.match(sql, /revoke all(?: on table)? [^;]+ from anon/i, `${name} revokes anonymous table privileges`);
  for (const command of ["select", "insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`for ${command} to authenticated`, "i"), `${name} has an authenticated ${command} policy`);
  }
}

for (const action of ["read", "insert", "update", "delete"]) {
  assert.match(normalization, new RegExp(`drop policy if exists "Users can ${action} own study entries"`, "i"), `normalization removes legacy ${action} policy`);
  assert.match(normalization, new RegExp(`create policy "Users can ${action} their study entries"`, "i"), `normalization creates canonical ${action} policy`);
}

assert.match(normalization, /revoke all on table public\.study_entries from anon/i, "normalization revokes anonymous study entry privileges");

console.log("migration tests passed");
