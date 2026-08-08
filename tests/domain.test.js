"use strict";

const assert = require("node:assert/strict");
const domain = require("../domain.js");

const entries = [
  { date: "2026-08-09", language: "en", activity: "listening", minutes: 20 },
  { date: "2026-08-09", language: "en", activity: "reading", minutes: 30 },
  { date: "2026-08-08", language: "en", activity: "listening", minutes: 40 },
  { date: "2026-07-12", language: "en", activity: "reading", minutes: 100 },
  { date: "2026-08-10", language: "en", activity: "reading", minutes: 999 },
  { date: "2026-08-09", language: "ja", activity: "retell", minutes: 60 },
];

assert.equal(domain.totalMinutes(entries, "en"), 1189, "language total includes all English records only");
assert.equal(domain.totalMinutes(entries, "ja"), 60, "Japanese total remains independent");

const month = domain.monthSummary(entries, "en", new Date(2026, 7, 9, 12), "2026-08-09");
assert.equal(month.activeDays, 2, "month summary deduplicates dates and can exclude future records");
assert.equal(month.byDay.get("2026-08-09"), 50, "same-day entries are summed");

const rolling = domain.rollingDailyAverage(entries, "en", new Date(2026, 7, 9, 12), 28);
assert.equal(rolling, 90 / 28, "rolling average excludes future and out-of-window records");

const estimated = domain.eta(entries.slice(0, 3), "en", 300, new Date(2026, 7, 9, 12), 28);
assert.equal(estimated.days, Math.ceil(210 / (90 / 28)), "ETA uses the 28-calendar-day average");
assert.equal(domain.eta(entries, "en", 1200, new Date(2026, 7, 9, 12), 28).days, Math.ceil(1010 / (90 / 28)), "future records do not reduce ETA remaining time");
assert.equal(domain.eta(entries, "ja", 60, new Date(2026, 7, 9, 12)).label, "已达成", "completed goals never show a negative ETA");
assert.equal(domain.eta([], "en", 30000, new Date(2026, 7, 9, 12)).label, "—", "empty data has no meaningless ETA");

assert.equal(domain.streak(entries, "en", new Date(2026, 7, 9, 12)), 2, "today and yesterday form the current streak");
assert.equal(domain.streak([{ date: "2026-08-08", language: "en" }], "en", new Date(2026, 7, 9, 12)), 1, "streak may begin yesterday when today is empty");

const series = domain.dailySeries(entries, "en", ["listening", "reading"], new Date(2026, 7, 9, 12), 2);
assert.deepEqual(series.map((day) => day.total), [40, 50], "daily series includes empty-safe per-day totals");
assert.equal(series[1].activities.reading, 30, "daily series preserves activity breakdown");

const review = domain.monthReview(entries, "en", ["listening", "reading"], new Date(2026, 7, 9, 12));
assert.equal(review.topActivity.id, "listening", "monthly review identifies the leading activity without future records");
assert.equal(review.averageActiveDay, 45, "monthly active-day average uses unique dates through today");

assert.equal(domain.daysInMonth(new Date(2024, 1, 15)), 29, "leap February has 29 days");
assert.equal(domain.daysInMonth(new Date(2025, 1, 15)), 28, "common February has 28 days");
assert.equal(domain.heatLevel(0), 0);
assert.equal(domain.heatLevel(14), 1);
assert.equal(domain.heatLevel(15), 2);
assert.equal(domain.heatLevel(30), 3);
assert.equal(domain.heatLevel(60), 4);

console.log("domain tests passed");
