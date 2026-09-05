"use strict";

const SUPABASE_URL = "https://lqjjzcuptepzfbeuegba.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IIYCJooY-Fkk2oEvWl6xPA_g0vl6S3h";
const LEGACY_KEYS = ["lang_countdown_v2", "en500h_v1"];
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
const D = window.StudyDomain;
const cloud = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const PAGES = {
  en: {
    label: "英语",
    goalLabel: "英语目标 · 500 小时",
    title: "流利英语时间账户",
    totalMinutes: 500 * 60,
    activities: [
      { id: "listening", label: "精听" },
      { id: "extensive", label: "泛听" },
      { id: "reading", label: "阅读" },
      { id: "retell", label: "复述" },
      { id: "anki", label: "Anki" },
    ],
    milestones: [
      { hours: 100, title: "慢速听清", description: "盲听慢速材料一遍理解约 80%；就熟悉话题连续说 2 分钟" },
      { hours: 200, title: "接近常速", description: "能跟上 6 Minute English；与人对话 10 分钟而不中断" },
      { hours: 300, title: "常速门槛", description: "常速播客理解约 70%；即兴谈论工作话题 5 分钟" },
      { hours: 400, title: "自我纠正", description: "无字幕访谈理解大意；对话中可以自我纠正" },
      { hours: 500, title: "流利对话", description: "与母语者进行日常对话基本无障碍" },
    ],
    plan: [
      ["精听 ★", "15–20 分钟", "盲听 → 逐句辨音 → 对文本标记 → 跟读", "毕业标准：盲听一遍实时理解约 95%"],
      ["泛听", "10 分钟", "听已经精听过或正在精听的材料，只抓大意", ""],
      ["阅读", "10 分钟", "阅读约 925L 的短新闻，第二遍只处理关键障碍词", ""],
      ["复述 ★", "5 分钟", "合上材料，用英语复述 3–5 句", ""],
      ["Anki", "5 分钟", "使用提取卡片说出句子，而不是只认单词", ""],
    ],
  },
  ja: {
    label: "日语",
    goalLabel: "日语目标 · 800 小时",
    title: "日语流利时间账户",
    totalMinutes: 800 * 60,
    activities: [
      { id: "movie-listening", label: "影视精听" },
      { id: "line-repeat", label: "台词跟读" },
      { id: "retell", label: "复述" },
      { id: "extensive", label: "泛听" },
    ],
    milestones: [
      { hours: 200, title: "N3 巩固", description: "慢速日剧片段盲听约 70%；日常话题连续说 3 分钟" },
      { hours: 400, title: "N2 水平", description: "常速生活场景理解约 60%–70%；日常对话能够持续" },
      { hours: 600, title: "常速适应", description: "无字幕电影能理解大意；口语开始稳定使用中级表达" },
      { hours: 800, title: "流利日常", description: "无字幕影视理解约 80% 以上；日常对话基本无障碍" },
    ],
    plan: [
      ["影视精听 ★", "10–15 分钟", "盲听 → 逐句 → 对日文字幕 → 跟读", "重点观察口语缩约与音变"],
      ["台词跟读 ★", "5 分钟", "模仿精听片段，把地道表达搬进口语", ""],
      ["复述", "5 分钟", "用日语复述 3–5 句剧情", ""],
      ["泛听", "5–10 分钟", "用影视或播客维持每日接触", ""],
    ],
  },
};

let session = null;
let entries = [];
let milestoneChecks = [];
let sessionLoadToken = 0;
let toastTimer = null;
const dailyRanges = { en: 7, ja: 7 };
const recordFilters = { en: { month: "", activity: "" }, ja: { month: "", activity: "" } };

function pageElement(language) {
  return document.getElementById("page-" + language);
}

function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("error", isError);
}

function showToast(text, isError = false) {
  const toast = document.getElementById("toast");
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.remove("hidden");
  toast.classList.toggle("error", isError);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

function friendlyError(error) {
  const message = (error && error.message) || "操作没有完成";
  if (/Invalid login credentials/i.test(message)) return "邮箱或密码不正确。";
  if (/already registered/i.test(message)) return "这个邮箱已经注册，请直接登录。";
  if (/password/i.test(message) && /least/i.test(message)) return "密码长度不足，请使用至少 8 位密码。";
  if (/rate limit/i.test(message)) return "操作过于频繁，请稍后再试。";
  if (/fetch|network|offline/i.test(message)) return "网络连接失败，请联网后重试。";
  return "操作失败：" + message;
}

function requireOnline(messageElement) {
  if (navigator.onLine) return true;
  if (messageElement) setMessage(messageElement, "当前离线，联网后才能操作。", true);
  else showToast("当前离线，联网后才能操作。", true);
  return false;
}

function activityLabel(language, id) {
  const item = PAGES[language].activities.find((activity) => activity.id === id);
  return item ? item.label : "未分类";
}

function activityColor(index) {
  return SERIES[index % SERIES.length];
}

function buildLanguagePages() {
  const pages = document.getElementById("pages");
  pages.replaceChildren();
  Object.entries(PAGES).forEach(([language, config], index) => {
    const article = document.createElement("article");
    article.className = "language-page " + (index === 0 ? "show" : "");
    article.id = "page-" + language;
    article.setAttribute("role", "tabpanel");
    article.setAttribute("aria-labelledby", "tab-" + language);
    article.hidden = index !== 0;
    article.innerHTML = `
      <section class="hero">
        <div class="hero-copy"><span class="eyebrow">${config.goalLabel}</span><h1><span class="remaining-hours">0</span><small> 小时</small></h1><p class="hero-summary"></p></div>
        <div class="progress-ring"><div class="progress-ring-copy"><strong class="progress-percent">0%</strong><span>已完成</span></div></div>
      </section>
      <div class="progress-track"><div class="progress-fill"></div></div>

      <section class="quick-entry">
        <div class="quick-entry-heading"><h2>今天，继续积累一点</h2><span>只记录真正完成的有效学习</span></div>
        <div class="entry-row">
          <div class="field"><label for="${language}-date">学习日期</label><input id="${language}-date" class="entry-date" type="date" required></div>
          <div class="field"><label for="${language}-activity">训练项目</label><select id="${language}-activity" class="entry-activity"></select></div>
          <div class="field"><label for="${language}-minutes">分钟数</label><input id="${language}-minutes" class="entry-minutes" type="number" min="1" max="600" step="1" inputmode="numeric" required></div>
          <button class="entry-button" type="button">入账</button>
        </div>
        <div class="quick-minutes" aria-label="快捷分钟数"></div>
        <p class="entry-message" role="status" aria-live="polite"></p>
      </section>

      <section class="stats-row" aria-label="学习统计">
        <div class="stat-card"><div class="stat-value stat-days">0</div><div class="stat-label">学习天数</div></div>
        <div class="stat-card"><div class="stat-value stat-average">0</div><div class="stat-label">学习日日均分钟</div></div>
        <div class="stat-card"><div class="stat-value stat-streak">0</div><div class="stat-label">连续天数</div></div>
        <div class="stat-card"><div class="stat-value stat-eta">—</div><div class="stat-label">预计完成日 · 近 28 天</div></div>
      </section>

      <section class="section insight-grid">
        <div>
          <div class="section-heading"><h2>本月学习热力图</h2><span class="section-summary heatmap-summary"></span></div>
          <div class="panel heatmap-panel">
            <div class="heatmap-weekdays" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
            <div class="heatmap-grid" role="grid"></div>
            <div class="heat-legend" aria-label="颜色越深表示学习时间越长"><span>少</span><i class="legend-swatch"></i><i class="legend-swatch l1"></i><i class="legend-swatch l2"></i><i class="legend-swatch l3"></i><i class="legend-swatch l4"></i><span>多</span></div>
          </div>
        </div>
        <div>
          <div class="section-heading"><h2>累计时间构成</h2><span class="section-summary composition-summary"></span></div>
          <div class="panel composition-body"><div class="composition-ring"><div class="composition-donut"></div><div class="composition-total"><strong>0h</strong><span>累计</span></div></div><div class="composition-list"></div></div>
        </div>
      </section>

      <section class="section">
        <div class="section-heading"><div><h2>每日训练节奏</h2><p>每天的总时长与训练项目构成</p></div><div class="range-buttons" aria-label="时间范围"><button class="active" data-days="7" type="button">7 天</button><button data-days="14" type="button">14 天</button><button data-days="30" type="button">30 天</button></div></div>
        <div class="panel"><div class="daily-chart-scroll"><div class="daily-chart"></div></div><div class="chart-legend"></div></div>
      </section>

      <section class="section">
        <div class="section-heading"><div><h2>本月复盘</h2><p>用事实观察节奏，不做断签评判</p></div><span class="section-summary review-month"></span></div>
        <div class="panel"><div class="review-grid"></div><p class="review-note"></p></div>
      </section>

      <section class="section">
        <div class="section-heading"><div><h2>里程碑验收</h2><p>到达小时节点后，再用真实能力测试确认</p></div></div>
        <div class="milestone-list"></div>
      </section>

      <section class="section">
        <details class="plan-details"><summary>查看推荐训练方案</summary><div class="plan-table-wrap"><table class="plan-table"><thead><tr><th>项目</th><th>建议时长</th><th>训练方法</th></tr></thead><tbody></tbody></table></div></details>
      </section>

      <section class="section">
        <div class="section-heading"><div><h2>学习记录</h2><p>按月份或训练项目筛选</p></div></div>
        <div class="panel">
          <div class="record-filters"><div class="field"><label for="${language}-month-filter">月份</label><select id="${language}-month-filter" class="month-filter filter-select"></select></div><div class="field"><label for="${language}-activity-filter">训练项目</label><select id="${language}-activity-filter" class="activity-filter filter-select"></select></div><span class="record-count"></span></div>
          <div class="record-list"></div>
        </div>
      </section>

      <section class="section"><div class="panel data-panel"><div><strong>数据管理</strong><p>JSON 可完整备份和恢复；重复导入会自动跳过同一笔记录。</p></div><div class="data-buttons"><button class="small-button export-json" type="button">导出 JSON</button><button class="small-button import-json" type="button">导入 JSON</button><input class="import-json-input hidden" type="file" accept="application/json,.json"><button class="small-button export-csv" type="button">导出 CSV</button><button class="small-button danger-button clear-data" type="button">清空云端数据</button></div></div></section>
    `;

    const activitySelect = article.querySelector(".entry-activity");
    const activityFilter = article.querySelector(".activity-filter");
    activityFilter.append(new Option("全部项目", ""));
    config.activities.forEach((activity) => {
      activitySelect.append(new Option(activity.label, activity.id));
      activityFilter.append(new Option(activity.label, activity.id));
    });
    activityFilter.append(new Option("未分类", "uncategorized"));
    article.querySelector(".entry-date").value = D.localDate();
    article.querySelector(".entry-date").max = D.localDate();
    [15, 30, 45, 60].forEach((minutes) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = minutes + " 分钟";
      button.dataset.minutes = String(minutes);
      article.querySelector(".quick-minutes").append(button);
    });
    const tbody = article.querySelector(".plan-table tbody");
    config.plan.forEach(([name, minutes, method, note]) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${name}</td><td>${minutes}</td><td>${method}${note ? `<span class="plan-note">${note}</span>` : ""}</td>`;
      tbody.append(row);
    });
    pages.append(article);
    bindPageEvents(language, article);
  });
}

function bindPageEvents(language, page) {
  const minutesInput = page.querySelector(".entry-minutes");
  page.querySelector(".entry-button").addEventListener("click", () => addEntry(language));
  minutesInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addEntry(language);
    }
  });
  page.querySelector(".quick-minutes").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-minutes]");
    if (!button) return;
    minutesInput.value = button.dataset.minutes;
    addEntry(language);
  });
  page.querySelector(".range-buttons").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-days]");
    if (!button) return;
    dailyRanges[language] = Number(button.dataset.days);
    renderDailyChart(language);
  });
  page.querySelector(".milestone-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-hours]");
    if (button) toggleMilestone(language, Number(button.dataset.hours));
  });
  page.querySelector(".record-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-entry-id]");
    if (button) deleteEntry(button.dataset.entryId, language);
  });
  page.querySelector(".month-filter").addEventListener("change", (event) => {
    recordFilters[language].month = event.target.value;
    renderRecords(language);
  });
  page.querySelector(".activity-filter").addEventListener("change", (event) => {
    recordFilters[language].activity = event.target.value;
    renderRecords(language);
  });
  page.querySelector(".export-json").addEventListener("click", exportJson);
  page.querySelector(".import-json").addEventListener("click", () => page.querySelector(".import-json-input").click());
  page.querySelector(".import-json-input").addEventListener("change", (event) => importJsonBackup(event.target));
  page.querySelector(".export-csv").addEventListener("click", exportCsv);
  page.querySelector(".clear-data").addEventListener("click", clearCloudData);
}

function renderAll() {
  renderPage("en");
  renderPage("ja");
}

function renderPage(language) {
  const config = PAGES[language];
  const page = pageElement(language);
  const mine = D.languageEntries(entries, language);
  const done = D.totalMinutes(entries, language);
  const remaining = Math.max(0, config.totalMinutes - done);
  const percent = Math.min(100, done / config.totalMinutes * 100);
  const activeDays = new Set(mine.map((entry) => entry.date)).size;
  const activeAverage = activeDays ? done / activeDays : 0;
  const estimate = D.eta(entries, language, config.totalMinutes, new Date(), 28);

  page.querySelector(".remaining-hours").textContent = D.formatHours(remaining);
  page.querySelector(".hero-summary").textContent = `已投入 ${done} 分钟（${D.formatHours(done)} 小时） · 完成 ${percent.toFixed(1)}%`;
  page.querySelector(".progress-percent").textContent = percent.toFixed(1) + "%";
  page.querySelector(".progress-ring").style.setProperty("--progress", percent * 3.6 + "deg");
  page.querySelector(".progress-fill").style.width = percent + "%";
  renderProgressTicks(language);
  page.querySelector(".stat-days").textContent = activeDays;
  page.querySelector(".stat-average").textContent = Math.round(activeAverage);
  page.querySelector(".stat-streak").textContent = D.streak(entries, language);
  page.querySelector(".stat-eta").textContent = estimate.label;
  renderHeatmap(language);
  renderComposition(language);
  renderDailyChart(language);
  renderMonthlyReview(language);
  renderMilestones(language);
  renderRecordFilterOptions(language);
  renderRecords(language);
}

function renderProgressTicks(language) {
  const page = pageElement(language);
  const config = PAGES[language];
  const track = page.querySelector(".progress-track");
  track.querySelectorAll(".progress-tick,.progress-tick-label").forEach((element) => element.remove());
  config.milestones.forEach((milestone) => {
    const left = milestone.hours / (config.totalMinutes / 60) * 100 + "%";
    const tick = document.createElement("i");
    tick.className = "progress-tick";
    tick.style.left = left;
    const label = document.createElement("span");
    label.className = "progress-tick-label";
    label.style.left = left;
    label.textContent = milestone.hours + "h";
    track.append(tick, label);
  });
}

function renderHeatmap(language, now = new Date()) {
  const page = pageElement(language);
  const grid = page.querySelector(".heatmap-grid");
  const today = D.localDate(now);
  const summary = D.monthSummary(entries, language, now, today);
  const month = now.getMonth() + 1;
  page.querySelector(".heatmap-summary").textContent = `${month} 月 · ${summary.activeDays} 天 · ${summary.total} 分钟`;
  grid.setAttribute("aria-label", `${now.getFullYear()} 年 ${month} 月学习记录`);
  grid.replaceChildren();
  for (let index = 0; index < D.leadingMondayCells(now); index += 1) {
    const blank = document.createElement("span");
    blank.className = "heat-day blank";
    blank.setAttribute("aria-hidden", "true");
    grid.append(blank);
  }
  for (let day = 1; day <= D.daysInMonth(now); day += 1) {
    const date = summary.key + "-" + String(day).padStart(2, "0");
    const minutes = summary.byDay.get(date) || 0;
    const cell = document.createElement("div");
    cell.className = `heat-day level-${D.heatLevel(minutes)}` + (date === today ? " today" : "") + (date > today ? " future" : "");
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `${now.getFullYear()} 年 ${month} 月 ${day} 日，学习 ${minutes} 分钟`);
    cell.title = `${month} 月 ${day} 日 · ${minutes} 分钟`;
    const dateLabel = document.createElement("span");
    dateLabel.className = "heat-date";
    dateLabel.textContent = day;
    cell.append(dateLabel);
    if (minutes) {
      const minuteLabel = document.createElement("span");
      minuteLabel.className = "heat-min";
      minuteLabel.textContent = minutes + "m";
      cell.append(minuteLabel);
    }
    grid.append(cell);
  }
}

function renderComposition(language) {
  const page = pageElement(language);
  const config = PAGES[language];
  const ids = config.activities.map((activity) => activity.id);
  const result = D.activityTotals(entries, language, ids);
  const list = page.querySelector(".composition-list");
  const segments = [];
  let cursor = 0;
  list.replaceChildren();
  config.activities.forEach((activity, index) => {
    const minutes = result.totals.get(activity.id) || 0;
    const percent = result.total ? minutes / result.total * 100 : 0;
    if (percent) {
      segments.push(`${activityColor(index)} ${cursor}% ${cursor + percent}%`);
      cursor += percent;
    }
    const item = document.createElement("div");
    item.className = "composition-item";
    item.style.setProperty("--series", activityColor(index));
    item.innerHTML = `<i></i><span></span><strong></strong>`;
    item.children[1].textContent = activity.label;
    item.children[2].textContent = Math.round(percent) + "%";
    list.append(item);
  });
  if (result.uncategorized) {
    const percent = result.uncategorized / result.total * 100;
    segments.push(`var(--line) ${cursor}% 100%`);
    const item = document.createElement("div");
    item.className = "composition-item";
    item.style.setProperty("--series", "var(--line)");
    item.innerHTML = `<i></i><span>未分类</span><strong>${Math.round(percent)}%</strong>`;
    list.append(item);
  }
  const donut = page.querySelector(".composition-donut");
  donut.style.setProperty("--segments", segments.length ? `conic-gradient(${segments.join(",")})` : "var(--line)");
  page.querySelector(".composition-total strong").textContent = D.formatHours(result.total) + "h";
  page.querySelector(".composition-summary").textContent = result.total + " 分钟";
}

function renderDailyChart(language) {
  const page = pageElement(language);
  const config = PAGES[language];
  const days = dailyRanges[language];
  const ids = config.activities.map((activity) => activity.id);
  const series = D.dailySeries(entries, language, ids, new Date(), days);
  const maximum = Math.max(1, ...series.map((day) => day.total));
  const chart = page.querySelector(".daily-chart");
  chart.style.setProperty("--days", days);
  chart.style.setProperty("--chart-min", days === 30 ? "900px" : days === 14 ? "560px" : "0px");
  chart.replaceChildren();
  page.querySelectorAll(".range-buttons button").forEach((button) => button.classList.toggle("active", Number(button.dataset.days) === days));
  series.forEach((day) => {
    const column = document.createElement("div");
    column.className = "daily-column";
    column.setAttribute("aria-label", `${day.date}，学习 ${day.total} 分钟`);
    const stack = document.createElement("div");
    stack.className = "daily-stack";
    stack.title = `${day.date} · ${day.total} 分钟`;
    config.activities.forEach((activity, index) => {
      const minutes = day.activities[activity.id] || 0;
      if (!minutes) return;
      const segment = document.createElement("i");
      segment.className = "daily-segment";
      segment.style.height = minutes / maximum * 100 + "%";
      segment.style.setProperty("--series", activityColor(index));
      segment.title = `${activity.label} ${minutes} 分钟`;
      stack.append(segment);
    });
    if (day.uncategorized) {
      const segment = document.createElement("i");
      segment.className = "daily-segment";
      segment.style.height = day.uncategorized / maximum * 100 + "%";
      segment.style.setProperty("--series", "var(--line)");
      stack.append(segment);
    }
    const label = document.createElement("span");
    label.className = "daily-label";
    label.textContent = (day.dateObject.getMonth() + 1) + "/" + day.dateObject.getDate();
    column.append(stack, label);
    chart.append(column);
  });
  const legend = page.querySelector(".chart-legend");
  legend.replaceChildren();
  config.activities.forEach((activity, index) => {
    const item = document.createElement("span");
    item.style.setProperty("--series", activityColor(index));
    item.innerHTML = "<i></i>";
    item.append(activity.label);
    legend.append(item);
  });
}

function signedText(value, unit) {
  if (value > 0) return `比上月多 ${value}${unit}`;
  if (value < 0) return `比上月少 ${Math.abs(value)}${unit}`;
  return "与上月相同";
}

function renderMonthlyReview(language) {
  const page = pageElement(language);
  const config = PAGES[language];
  const review = D.monthReview(entries, language, config.activities.map((activity) => activity.id));
  page.querySelector(".review-month").textContent = Number(review.current.key.slice(5)) + " 月";
  const values = [
    [D.formatHours(review.current.total) + "h", "本月累计"],
    [review.current.activeDays, "本月学习天数"],
    [Math.round(review.averageActiveDay), "学习日日均分钟"],
    [review.topActivity ? activityLabel(language, review.topActivity.id) : "—", "投入最多项目"],
  ];
  const grid = page.querySelector(".review-grid");
  grid.replaceChildren();
  values.forEach(([value, label]) => {
    const metric = document.createElement("div");
    metric.className = "review-metric";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    metric.append(strong, span);
    grid.append(metric);
  });
  const note = page.querySelector(".review-note");
  note.textContent = review.current.total
    ? `${signedText(review.minuteDelta, " 分钟")}；${signedText(review.activeDayDelta, " 个学习日")}。变化只是节奏记录，不代表落后或失败。`
    : "本月还没有记录。今天学 5 分钟，也可以成为这个月的第一笔。";
}

function milestoneKey(language, hours) {
  return language + ":" + hours;
}

function isMilestoneVerified(language, hours) {
  return milestoneChecks.some((check) => milestoneKey(check.language, check.hours) === milestoneKey(language, hours));
}

function renderMilestones(language) {
  const page = pageElement(language);
  const config = PAGES[language];
  const done = D.totalMinutes(entries, language);
  const list = page.querySelector(".milestone-list");
  list.replaceChildren();
  config.milestones.forEach((milestone, index) => {
    const reached = done >= milestone.hours * 60;
    const verified = isMilestoneVerified(language, milestone.hours);
    const item = document.createElement("div");
    item.className = "milestone" + (reached ? " reached" : "") + (verified ? " verified" : "");
    const dot = document.createElement("div");
    dot.className = "milestone-dot";
    dot.textContent = verified ? "✓" : "";
    const copy = document.createElement("div");
    copy.innerHTML = `<div class="milestone-title"></div><div class="milestone-description"></div>`;
    copy.children[0].textContent = `里程碑 ${index + 1} · ${milestone.title}`;
    copy.children[1].textContent = milestone.description;
    const status = document.createElement("div");
    status.className = "milestone-status";
    const label = document.createElement("span");
    label.textContent = verified ? `${milestone.hours}h · 已验收` : reached ? `${milestone.hours}h · 待验收` : `${milestone.hours}h · 尚未到达`;
    const button = document.createElement("button");
    button.className = "milestone-action";
    button.type = "button";
    button.dataset.hours = String(milestone.hours);
    button.disabled = !reached;
    button.textContent = verified ? "取消通过" : "标记验收通过";
    status.append(label, button);
    item.append(dot, copy, status);
    list.append(item);
  });
}

function renderRecordFilterOptions(language) {
  const page = pageElement(language);
  const select = page.querySelector(".month-filter");
  const months = [...new Set(D.languageEntries(entries, language).map((entry) => entry.date.slice(0, 7)))].sort().reverse();
  const selected = recordFilters[language].month;
  select.replaceChildren(new Option("全部月份", ""));
  months.forEach((month) => select.append(new Option(month.replace("-", " 年 ") + " 月", month)));
  if (months.includes(selected)) select.value = selected;
  else recordFilters[language].month = "";
  page.querySelector(".activity-filter").value = recordFilters[language].activity;
}

function renderRecords(language) {
  const page = pageElement(language);
  const filter = recordFilters[language];
  const filtered = D.languageEntries(entries, language)
    .filter((entry) => !filter.month || entry.date.startsWith(filter.month + "-"))
    .filter((entry) => !filter.activity || (filter.activity === "uncategorized" ? !PAGES[language].activities.some((activity) => activity.id === entry.activity) : entry.activity === filter.activity))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  page.querySelector(".record-count").textContent = filtered.length + " 条记录";
  const list = page.querySelector(".record-list");
  list.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = entries.length ? "当前筛选条件下没有记录。" : "还没有记录，今天学 5 分钟也算入账。";
    list.append(empty);
    return;
  }
  filtered.slice(0, 80).forEach((entry) => {
    const row = document.createElement("div");
    row.className = "record-item";
    const date = document.createElement("span");
    date.textContent = entry.date;
    const minutes = document.createElement("span");
    minutes.className = "record-minutes";
    minutes.textContent = entry.minutes + " 分钟";
    const activity = document.createElement("span");
    activity.className = "record-activity";
    activity.textContent = activityLabel(language, entry.activity);
    const remove = document.createElement("button");
    remove.className = "delete-record";
    remove.type = "button";
    remove.dataset.entryId = entry.id;
    remove.setAttribute("aria-label", `删除 ${entry.date} 的 ${entry.minutes} 分钟记录`);
    remove.textContent = "×";
    row.append(date, minutes, activity, remove);
    list.append(row);
  });
}

function mapEntryRow(row) {
  return { id: row.id, clientRef: row.client_ref || row.id, date: row.study_date, language: row.language === "jp" ? "ja" : row.language, activity: row.activity, minutes: Number(row.minutes), createdAt: row.created_at };
}

function mapCheckRow(row) {
  return { language: row.language === "jp" ? "ja" : row.language, hours: Number(row.milestone_hours), verifiedAt: row.verified_at };
}

async function loadCloudData() {
  const [entryResult, checkResult] = await Promise.all([
    cloud.from("study_entries").select("id,client_ref,study_date,language,activity,minutes,created_at").order("study_date", { ascending: false }).order("created_at", { ascending: false }),
    cloud.from("milestone_checks").select("language,milestone_hours,verified_at"),
  ]);
  if (entryResult.error) throw entryResult.error;
  if (checkResult.error) throw checkResult.error;
  return { entries: (entryResult.data || []).map(mapEntryRow), checks: (checkResult.data || []).map(mapCheckRow) };
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeLegacy(raw, defaultLanguage, index) {
  if (!raw || typeof raw !== "object") return null;
  const originalLanguage = raw.language || raw.lang || defaultLanguage;
  const language = originalLanguage === "jp" ? "ja" : originalLanguage;
  const date = raw.date || raw.study_date;
  const minutes = Number(raw.minutes ?? raw.min);
  const activity = typeof raw.activity === "string" && raw.activity ? raw.activity : "uncategorized";
  if (!["en", "ja"].includes(language) || !D.parseLocalDate(date) || !Number.isInteger(minutes) || minutes < 1 || minutes > 600) return null;
  let createdAt = raw.createdAt || raw.created_at;
  const legacyTime = Number(raw.ts);
  if (!createdAt && Number.isFinite(legacyTime)) {
    const parsed = new Date(legacyTime);
    if (!Number.isNaN(parsed.getTime())) createdAt = parsed.toISOString();
  }
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) createdAt = new Date(Date.now() + index).toISOString();
  const signature = [language, date, activity, minutes, createdAt].join("|");
  return { client_ref: "legacy-" + stableHash(signature), study_date: date, language, activity, minutes, created_at: createdAt };
}

async function migrateLegacyData() {
  const marker = `500hours_cloud_migrated_${session.user.id}_v1`;
  if (localStorage.getItem(marker)) return 0;
  const all = [];
  LEGACY_KEYS.forEach((key, keyIndex) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(parsed)) parsed.forEach((raw, index) => {
        const item = normalizeLegacy(raw, key === "en500h_v1" ? "en" : undefined, keyIndex * 100000 + index);
        if (item) all.push(item);
      });
    } catch (_) {}
  });
  const unique = [...new Map(all.map((item) => [item.client_ref, item])).values()];
  if (unique.length) {
    const payload = unique.map((item) => ({ ...item, user_id: session.user.id }));
    const { error } = await cloud.from("study_entries").upsert(payload, { onConflict: "user_id,client_ref", ignoreDuplicates: true });
    if (error) throw error;
  }
  localStorage.setItem(marker, "1");
  return unique.length;
}

async function addEntry(language) {
  const page = pageElement(language);
  const message = page.querySelector(".entry-message");
  const date = page.querySelector(".entry-date").value;
  const activity = page.querySelector(".entry-activity").value;
  const minutes = Number(page.querySelector(".entry-minutes").value);
  const button = page.querySelector(".entry-button");
  if (!requireOnline(message)) return;
  if (!D.parseLocalDate(date) || date > D.localDate()) {
    setMessage(message, "请选择今天或更早的有效日期。", true);
    return;
  }
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    setMessage(message, "分钟数必须是 1–600 之间的整数。", true);
    return;
  }
  button.disabled = true;
  setMessage(message, "正在写入云端…");
  const id = crypto.randomUUID();
  try {
    const { data, error } = await cloud.from("study_entries").insert({ id, user_id: session.user.id, client_ref: id, study_date: date, language, activity, minutes }).select("id,client_ref,study_date,language,activity,minutes,created_at").single();
    if (error) throw error;
    entries.push(mapEntryRow(data));
    renderAll();
    page.querySelector(".entry-minutes").value = "";
    setMessage(message, "已入账并同步到云端。");
    page.querySelector(".entry-minutes").focus();
  } catch (error) {
    setMessage(message, friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

async function deleteEntry(id, language) {
  const message = pageElement(language).querySelector(".entry-message");
  if (!requireOnline(message)) return;
  setMessage(message, "正在删除…");
  try {
    const { error } = await cloud.from("study_entries").delete().eq("id", id);
    if (error) throw error;
    entries = entries.filter((entry) => entry.id !== id);
    renderAll();
    setMessage(message, "记录已删除。");
  } catch (error) {
    setMessage(message, friendlyError(error), true);
  }
}

async function toggleMilestone(language, hours) {
  if (!requireOnline()) return;
  const verified = isMilestoneVerified(language, hours);
  try {
    if (verified) {
      const { error } = await cloud.from("milestone_checks").delete().eq("language", language).eq("milestone_hours", hours);
      if (error) throw error;
      milestoneChecks = milestoneChecks.filter((check) => milestoneKey(check.language, check.hours) !== milestoneKey(language, hours));
      showToast("已取消该里程碑的验收状态。");
    } else {
      const { data, error } = await cloud.from("milestone_checks").upsert({ user_id: session.user.id, language, milestone_hours: hours }, { onConflict: "user_id,language,milestone_hours" }).select("language,milestone_hours,verified_at").single();
      if (error) throw error;
      milestoneChecks.push(mapCheckRow(data));
      showToast("已标记为验收通过。");
    }
    renderMilestones(language);
  } catch (error) {
    showToast(friendlyError(error), true);
  }
}

function downloadBlob(contents, type, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), entries, milestoneChecks };
  downloadBlob(JSON.stringify(payload, null, 2), "application/json;charset=utf-8", `500hours-${D.localDate()}-backup.json`);
  showToast("JSON 备份已导出。");
}

async function importJsonBackup(input) {
  const file = input.files && input.files[0];
  if (!file || !requireOnline()) return;
  try {
    const backup = D.normalizeBackup(JSON.parse(await file.text()));
    const batchSize = 500;
    for (let offset = 0; offset < backup.entries.length; offset += batchSize) {
      const payload = backup.entries.slice(offset, offset + batchSize).map((entry) => ({
        user_id: session.user.id,
        client_ref: entry.clientRef,
        study_date: entry.date,
        language: entry.language,
        activity: entry.activity,
        minutes: entry.minutes,
        created_at: entry.createdAt,
      }));
      const { error } = await cloud.from("study_entries").upsert(payload, { onConflict: "user_id,client_ref", ignoreDuplicates: true });
      if (error) throw error;
    }
    if (backup.milestoneChecks.length) {
      const payload = backup.milestoneChecks.map((check) => ({
        user_id: session.user.id,
        language: check.language,
        milestone_hours: check.hours,
        verified_at: check.verifiedAt,
      }));
      const { error } = await cloud.from("milestone_checks").upsert(payload, { onConflict: "user_id,language,milestone_hours" });
      if (error) throw error;
    }
    const cloudData = await loadCloudData();
    entries = cloudData.entries;
    milestoneChecks = cloudData.checks;
    renderAll();
    showToast(`备份已合并：${backup.entries.length} 条记录，${backup.milestoneChecks.length} 个里程碑状态。`);
  } catch (error) {
    const message = error instanceof SyntaxError ? "备份文件不是有效的 JSON。" : friendlyError(error);
    showToast(message, true);
  } finally {
    input.value = "";
  }
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  const header = ["id", "date", "language", "activity", "minutes", "createdAt"];
  const rows = entries.map((entry) => header.map((key) => csvCell(entry[key])).join(","));
  downloadBlob("\ufeff" + [header.join(","), ...rows].join("\r\n"), "text/csv;charset=utf-8", `500hours-${D.localDate()}-entries.csv`);
  showToast("CSV 学习记录已导出。");
}

async function clearCloudData() {
  if (!confirm("确定清空当前账号的全部学习记录与里程碑验收状态？此操作不可恢复。")) return;
  if (!confirm("请再次确认：英语和日语的全部云端数据都会被永久删除。")) return;
  if (!requireOnline()) return;
  try {
    const checksResult = await cloud.from("milestone_checks").delete().eq("user_id", session.user.id);
    if (checksResult.error) throw checksResult.error;
    const entriesResult = await cloud.from("study_entries").delete().eq("user_id", session.user.id);
    if (entriesResult.error) throw entriesResult.error;
    entries = [];
    milestoneChecks = [];
    renderAll();
    showToast("当前账号的云端数据已清空。");
  } catch (error) {
    showToast(friendlyError(error), true);
  }
}

async function handleSession(nextSession) {
  const token = ++sessionLoadToken;
  session = nextSession;
  const authPanel = document.getElementById("authPanel");
  const appShell = document.getElementById("appShell");
  if (!session) {
    entries = [];
    milestoneChecks = [];
    authPanel.classList.remove("hidden");
    appShell.classList.add("hidden");
    setMessage(document.getElementById("authMessage"), "");
    return;
  }
  authPanel.classList.add("hidden");
  appShell.classList.remove("hidden");
  const email = session.user.email || "已登录";
  document.getElementById("accountEmail").textContent = email;
  document.getElementById("accountInitial").textContent = email.slice(0, 1).toUpperCase();
  document.getElementById("syncState").textContent = "正在同步…";
  try {
    const migrated = await migrateLegacyData();
    const cloudData = await loadCloudData();
    if (token !== sessionLoadToken) return;
    entries = cloudData.entries;
    milestoneChecks = cloudData.checks;
    renderAll();
    document.getElementById("syncState").textContent = migrated ? `已上传 ${migrated} 条旧记录` : "云端已同步";
  } catch (error) {
    if (token !== sessionLoadToken) return;
    document.getElementById("syncState").textContent = "同步失败";
    showToast(friendlyError(error), true);
  }
}

function setAuthBusy(busy) {
  document.getElementById("loginButton").disabled = busy;
  document.getElementById("signupButton").disabled = busy;
  document.getElementById("forgotPasswordButton").disabled = busy;
}

function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

async function authenticate(mode) {
  const message = document.getElementById("authMessage");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!requireOnline(message)) return;
  if (!validEmail(email)) {
    setMessage(message, "请输入有效邮箱。", true);
    return;
  }
  if (password.length < 6) {
    setMessage(message, "密码至少需要 6 位。", true);
    return;
  }
  setAuthBusy(true);
  setMessage(message, mode === "signup" ? "正在注册…" : "正在登录…");
  try {
    if (mode === "signup") {
      const { data, error } = await cloud.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) throw error;
      if (!data.session) setMessage(message, "确认邮件已发送。请打开邮件完成确认后再登录。");
    } else {
      const { error } = await cloud.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    setMessage(message, friendlyError(error), true);
  } finally {
    setAuthBusy(false);
  }
}

async function sendPasswordReset() {
  const message = document.getElementById("authMessage");
  const email = document.getElementById("email").value.trim();
  if (!requireOnline(message)) return;
  if (!validEmail(email)) {
    setMessage(message, "请先填写需要找回密码的邮箱。", true);
    return;
  }
  setAuthBusy(true);
  setMessage(message, "正在发送重置邮件…");
  try {
    const { error } = await cloud.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    if (error) throw error;
    setMessage(message, "密码重置邮件已发送，请打开邮件中的链接。");
  } catch (error) {
    setMessage(message, friendlyError(error), true);
  } finally {
    setAuthBusy(false);
  }
}

function openPasswordDialog(recovery = false) {
  const dialog = document.getElementById("passwordDialog");
  document.getElementById("passwordForm").reset();
  setMessage(document.getElementById("passwordMessage"), recovery ? "已验证重置链接，请设置新密码。" : "");
  if (!dialog.open) dialog.showModal();
}

async function updatePassword(event) {
  event.preventDefault();
  const message = document.getElementById("passwordMessage");
  const password = document.getElementById("newPassword").value;
  const confirmation = document.getElementById("confirmPassword").value;
  const button = document.getElementById("savePasswordButton");
  if (!requireOnline(message)) return;
  if (password.length < 8) {
    setMessage(message, "新密码至少需要 8 位。", true);
    return;
  }
  if (password !== confirmation) {
    setMessage(message, "两次输入的密码不一致。", true);
    return;
  }
  button.disabled = true;
  setMessage(message, "正在更新密码…");
  try {
    const { error } = await cloud.auth.updateUser({ password });
    if (error) throw error;
    setMessage(message, "密码已更新。");
    setTimeout(() => document.getElementById("passwordDialog").close(), 800);
  } catch (error) {
    setMessage(message, friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

function bindGlobalEvents() {
  document.getElementById("authForm").addEventListener("submit", (event) => {
    event.preventDefault();
    authenticate("login");
  });
  document.getElementById("signupButton").addEventListener("click", () => authenticate("signup"));
  document.getElementById("forgotPasswordButton").addEventListener("click", sendPasswordReset);
  document.getElementById("logoutButton").addEventListener("click", async () => {
    if (!requireOnline()) return;
    await cloud.auth.signOut();
  });
  document.getElementById("accountButton").addEventListener("click", () => {
    const menu = document.getElementById("accountMenu");
    const opening = menu.classList.contains("hidden");
    menu.classList.toggle("hidden", !opening);
    document.getElementById("accountButton").setAttribute("aria-expanded", String(opening));
  });
  document.getElementById("changePasswordButton").addEventListener("click", () => {
    document.getElementById("accountMenu").classList.add("hidden");
    openPasswordDialog(false);
  });
  document.getElementById("closePasswordDialog").addEventListener("click", () => document.getElementById("passwordDialog").close());
  document.getElementById("passwordForm").addEventListener("submit", updatePassword);
  document.addEventListener("click", (event) => {
    const area = event.target.closest(".account-area");
    if (!area) {
      document.getElementById("accountMenu").classList.add("hidden");
      document.getElementById("accountButton").setAttribute("aria-expanded", "false");
    }
  });
  const tabs = [...document.querySelectorAll(".language-tab")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      tabs.forEach((other) => {
        const active = other === tab;
        other.classList.toggle("active", active);
        other.setAttribute("aria-selected", String(active));
        const page = pageElement(other.dataset.page);
        page.classList.toggle("show", active);
        page.hidden = !active;
      });
    });
    tab.addEventListener("keydown", (event) => {
      let target = null;
      if (event.key === "ArrowRight") target = tabs[(index + 1) % tabs.length];
      if (event.key === "ArrowLeft") target = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === "Home") target = tabs[0];
      if (event.key === "End") target = tabs[tabs.length - 1];
      if (target) {
        event.preventDefault();
        target.focus();
        target.click();
      }
    });
  });
  window.addEventListener("online", () => { if (session) document.getElementById("syncState").textContent = "云端已连接"; });
  window.addEventListener("offline", () => { if (session) document.getElementById("syncState").textContent = "当前离线"; });
}

buildLanguagePages();
bindGlobalEvents();
renderAll();

cloud.auth.getSession().then(({ data, error }) => {
  if (error) setMessage(document.getElementById("authMessage"), friendlyError(error), true);
  else handleSession(data.session);
});

cloud.auth.onAuthStateChange((event, nextSession) => {
  if (event === "SIGNED_OUT") setTimeout(() => handleSession(null), 0);
  else if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && nextSession) {
    setTimeout(async () => {
      await handleSession(nextSession);
      if (event === "PASSWORD_RECOVERY") openPasswordDialog(true);
    }, 0);
  } else if (event === "TOKEN_REFRESHED") session = nextSession;
});
