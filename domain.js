(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StudyDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function localDate(date = new Date()) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function parseLocalDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
    const parsed = new Date(value + "T12:00:00");
    return !Number.isNaN(parsed.getTime()) && localDate(parsed) === value ? parsed : null;
  }

  function addLocalDays(date, amount) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function formatHours(minutes) {
    const hours = Number(minutes || 0) / 60;
    return Math.round(hours * 10) / 10;
  }

  function languageEntries(entries, language) {
    return entries.filter((entry) => entry.language === language);
  }

  function totalMinutes(entries, language) {
    return languageEntries(entries, language).reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
  }

  function streak(entries, language, now = new Date()) {
    const days = new Set(languageEntries(entries, language).map((entry) => entry.date));
    let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    let count = 0;
    if (!days.has(localDate(cursor))) cursor = addLocalDays(cursor, -1);
    while (days.has(localDate(cursor))) {
      count += 1;
      cursor = addLocalDays(cursor, -1);
    }
    return count;
  }

  function rollingDailyAverage(entries, language, now = new Date(), windowDays = 28) {
    const end = localDate(now);
    const start = localDate(addLocalDays(now, -(windowDays - 1)));
    const minutes = languageEntries(entries, language)
      .filter((entry) => entry.date >= start && entry.date <= end)
      .reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
    return minutes / windowDays;
  }

  function eta(entries, language, targetMinutes, now = new Date(), windowDays = 28) {
    const today = localDate(now);
    const done = languageEntries(entries, language)
      .filter((entry) => entry.date <= today)
      .reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
    const remaining = Math.max(0, targetMinutes - done);
    if (remaining === 0) return { label: "已达成", average: rollingDailyAverage(entries, language, now, windowDays), days: 0 };
    const average = rollingDailyAverage(entries, language, now, windowDays);
    if (average <= 0) return { label: "—", average, days: null };
    const days = Math.ceil(remaining / average);
    const date = addLocalDays(now, days);
    return { label: date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate(), average, days };
  }

  function heatLevel(minutes) {
    if (minutes <= 0) return 0;
    if (minutes < 15) return 1;
    if (minutes < 30) return 2;
    if (minutes < 60) return 3;
    return 4;
  }

  function monthKey(date = new Date()) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }

  function monthSummary(entries, language, date = new Date(), throughDate = null) {
    const key = monthKey(date);
    const byDay = new Map();
    languageEntries(entries, language).filter((entry) => entry.date.startsWith(key + "-") && (!throughDate || entry.date <= throughDate)).forEach((entry) => {
      byDay.set(entry.date, (byDay.get(entry.date) || 0) + Number(entry.minutes || 0));
    });
    const total = [...byDay.values()].reduce((sum, minutes) => sum + minutes, 0);
    return { key, byDay, total, activeDays: [...byDay.values()].filter(Boolean).length };
  }

  function activityTotals(entries, language, activityIds, month) {
    const totals = new Map(activityIds.map((id) => [id, 0]));
    let uncategorized = 0;
    languageEntries(entries, language).filter((entry) => !month || entry.date.startsWith(month + "-")).forEach((entry) => {
      if (totals.has(entry.activity)) totals.set(entry.activity, totals.get(entry.activity) + Number(entry.minutes || 0));
      else uncategorized += Number(entry.minutes || 0);
    });
    return { totals, uncategorized, total: [...totals.values()].reduce((sum, minutes) => sum + minutes, 0) + uncategorized };
  }

  function dailySeries(entries, language, activityIds, now = new Date(), days = 7) {
    const result = [];
    const mine = languageEntries(entries, language);
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = addLocalDays(now, -offset);
      const key = localDate(date);
      const activities = Object.fromEntries(activityIds.map((id) => [id, 0]));
      let uncategorized = 0;
      mine.filter((entry) => entry.date === key).forEach((entry) => {
        if (Object.prototype.hasOwnProperty.call(activities, entry.activity)) activities[entry.activity] += Number(entry.minutes || 0);
        else uncategorized += Number(entry.minutes || 0);
      });
      result.push({ date: key, dateObject: date, activities, uncategorized, total: Object.values(activities).reduce((sum, minutes) => sum + minutes, 0) + uncategorized });
    }
    return result;
  }

  function monthReview(entries, language, activityIds, now = new Date()) {
    const current = monthSummary(entries, language, now, localDate(now));
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12);
    const previous = monthSummary(entries, language, previousDate);
    const currentEntries = entries.filter((entry) => entry.date <= localDate(now));
    const breakdown = activityTotals(currentEntries, language, activityIds, current.key);
    let topActivity = null;
    for (const [id, minutes] of breakdown.totals.entries()) {
      if (!topActivity || minutes > topActivity.minutes) topActivity = { id, minutes };
    }
    if (topActivity && topActivity.minutes === 0) topActivity = null;
    return {
      current,
      previous,
      minuteDelta: current.total - previous.total,
      activeDayDelta: current.activeDays - previous.activeDays,
      averageActiveDay: current.activeDays ? current.total / current.activeDays : 0,
      topActivity,
    };
  }

  function daysInMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function leadingMondayCells(date = new Date()) {
    return (new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7;
  }

  function normalizeBackup(payload) {
    if (!payload || typeof payload !== "object" || payload.version !== 1 || !Array.isArray(payload.entries) || !Array.isArray(payload.milestoneChecks)) {
      throw new Error("备份文件结构不正确。请选择网站导出的 JSON 备份。");
    }
    const entryIds = new Set();
    const clientRefs = new Set();
    const normalizedEntries = payload.entries.map((entry, index) => {
      const language = entry && entry.language === "jp" ? "ja" : entry && entry.language;
      const id = entry && typeof entry.id === "string" ? entry.id.trim() : "";
      const clientRef = entry && typeof entry.clientRef === "string" ? entry.clientRef.trim() : "backup-" + id;
      const activity = entry && typeof entry.activity === "string" ? entry.activity.trim() : "";
      const minutes = Number(entry && entry.minutes);
      const createdAt = entry && entry.createdAt;
      if (!id || id.length > 200 || !clientRef || clientRef.length > 200 || entryIds.has(id) || clientRefs.has(clientRef) || !parseLocalDate(entry && entry.date) || !["en", "ja"].includes(language) || !activity || activity.length > 100 || !Number.isInteger(minutes) || minutes < 1 || minutes > 600 || typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
        throw new Error(`备份中的第 ${index + 1} 条学习记录无效。`);
      }
      entryIds.add(id);
      clientRefs.add(clientRef);
      return { id, clientRef, date: entry.date, language, activity, minutes, createdAt };
    });
    const checkKeys = new Set();
    const normalizedChecks = payload.milestoneChecks.map((check, index) => {
      const language = check && check.language === "jp" ? "ja" : check && check.language;
      const hours = Number(check && check.hours);
      const verifiedAt = check && check.verifiedAt;
      const key = language + ":" + hours;
      if (!["en", "ja"].includes(language) || !Number.isInteger(hours) || hours < 1 || checkKeys.has(key) || typeof verifiedAt !== "string" || Number.isNaN(Date.parse(verifiedAt))) {
        throw new Error(`备份中的第 ${index + 1} 个里程碑状态无效。`);
      }
      checkKeys.add(key);
      return { language, hours, verifiedAt };
    });
    return { entries: normalizedEntries, milestoneChecks: normalizedChecks };
  }

  return {
    localDate,
    parseLocalDate,
    addLocalDays,
    formatHours,
    languageEntries,
    totalMinutes,
    streak,
    rollingDailyAverage,
    eta,
    heatLevel,
    monthKey,
    monthSummary,
    activityTotals,
    dailySeries,
    monthReview,
    daysInMonth,
    leadingMondayCells,
    normalizeBackup,
  };
});
