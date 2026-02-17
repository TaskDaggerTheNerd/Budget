document.addEventListener("DOMContentLoaded", function () {
  // =========================
  // Storage + Constants
  // =========================
  let data = JSON.parse(localStorage.getItem("budgetDataV2")) || {};

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  // Euro formatting
  const EUR_FORMATTER = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
  function fmtEUR(value) {
    const n = Number(value);
    return EUR_FORMATTER.format(Number.isFinite(n) ? n : 0);
  }

  // Categories (Expenses only)
  const categories = {
    "Rent": [],
    "Food": ["Restaurant","Snack","Supermarket"],
    "Transport": ["Fuel","Electric","Parking","Toll","Uber"],
    "Subscriptions": ["Netflix","Prime","HBO"],
    "Shopping": [],
    "Health": [],
    "Insurance": ["House","Car"],
    "Utilities": ["Water","Electricity","Gas","Net&TV","Condominium"],
    "Entertainment": [],
    "Travel": [],
    "Others": []
  };

  // Main category colors (subcategories inherit)
  const CATEGORY_COLORS = {
    "Rent": "#ff3b30",
    "Food": "#ff9500",
    "Transport": "#ffcc00",
    "Subscriptions": "#34c759",
    "Shopping": "#5ac8fa",
    "Health": "#5856d6",
    "Insurance": "#af52de",
    "Utilities": "#8B5A2B",  // brown
    "Entertainment": "#8e8e93",
    "Travel": "#00c7be",
    "Others": "#000000"     // black
  };

  // Emojis
  const CATEGORY_EMOJIS = {
    "Rent": "🏠",
    "Food": "🍔",
    "Transport": "🚗",
    "Subscriptions": "🎬",
    "Shopping": "🛍️",
    "Health": "🩺",
    "Insurance": "🛡️",
    "Utilities": "💡",
    "Entertainment": "🎉",
    "Travel": "✈️",
    "Others": "✨"
  };

  function catLabel(main, sub) {
    const e = CATEGORY_EMOJIS[main] || "•";
    return `${e} ${main}${sub ? " – " + sub : ""}`;
  }

  function getMainCategoryFromSub(sub) {
    for (const main in categories) {
      if (categories[main].includes(sub)) return main;
    }
    return null;
  }

  // =========================
  // DOM elements
  // =========================
  const yearSelect = document.getElementById("yearSelect");
  const monthSelect = document.getElementById("monthSelect");
  const mainCategory = document.getElementById("mainCategory");
  const subCategory = document.getElementById("subCategory");
  const compareCategory = document.getElementById("compareCategory");
  const chartViewEl = document.getElementById("chartView");

  // Filters (Expenses block)
  const filterMain = document.getElementById("filterMain");
  const filterSub = document.getElementById("filterSub");
  const filterSearch = document.getElementById("filterSearch");
  const expensesTotalEl = document.getElementById("expensesTotal");

  // Dark mode toggle
  const darkToggle = document.getElementById("darkModeToggle");

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  // This holds the currently displayed entries (after filters/search),
  // so Edit/Delete/StopRecurring target the correct record.
  let currentVisibleEntries = [];

  // =========================
  // Dark Mode
  // =========================
  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark", isDark);
    if (darkToggle) darkToggle.checked = isDark;
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") applyTheme("dark");
  else applyTheme("light");

  if (darkToggle) {
    darkToggle.addEventListener("change", () => {
      applyTheme(darkToggle.checked ? "dark" : "light");
    });
  }

  // =========================
  // Populate Year/Month
  // =========================
  if (yearSelect) {
    yearSelect.innerHTML = "";
    for (let y = 2023; y <= 2035; y++) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }
    yearSelect.value = String(currentYear);
    yearSelect.addEventListener("change", () => {
      currentYear = Number(yearSelect.value);
      render();
    });
  }

  if (monthSelect) {
    monthSelect.innerHTML = "";
    months.forEach((m, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });
    monthSelect.value = String(currentMonth);
    monthSelect.addEventListener("change", () => {
      currentMonth = Number(monthSelect.value);
      render();
    });
  }

  // Jump to current month
  const jumpBtn = document.getElementById("jumpTodayBtn");
  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => {
      const now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
      if (yearSelect) yearSelect.value = String(currentYear);
      if (monthSelect) monthSelect.value = String(currentMonth);
      render();
    });
  }

  // =========================
  // Populate Categories + Compare Dropdown
  // =========================
  if (mainCategory) {
    mainCategory.innerHTML = "";
    Object.keys(categories).forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      mainCategory.appendChild(opt);
    });
  }

  function updateAddSubcategories() {
    if (!subCategory || !mainCategory) return;
    subCategory.innerHTML = "";

    const selected = mainCategory.value;
    const subs = categories[selected] || [];

    if (subs.length === 0) {
      subCategory.style.display = "none";
    } else {
      subCategory.style.display = "block";
      subs.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.textContent = sub;
        subCategory.appendChild(opt);
      });
    }
  }

  if (mainCategory) mainCategory.addEventListener("change", updateAddSubcategories);
  updateAddSubcategories();

  // Compare dropdown
  if (compareCategory) {
    compareCategory.innerHTML = "";
    const totalOpt = document.createElement("option");
    totalOpt.value = "Total";
    totalOpt.textContent = "Total";
    compareCategory.appendChild(totalOpt);

    Object.keys(categories).forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      compareCategory.appendChild(opt);
    });

    compareCategory.value = "Total";
  }

  // Ensure dropdown changes update charts immediately
  if (chartViewEl) chartViewEl.addEventListener("change", render);
  if (compareCategory) compareCategory.addEventListener("change", render);

  // Expose render in case any inline calls exist
  window.render = render;

  // =========================
  // Filters setup
  // =========================
  function populateMainFilter() {
    if (!filterMain) return;
    filterMain.innerHTML = "";
    const all = document.createElement("option");
    all.value = "All";
    all.textContent = "All";
    filterMain.appendChild(all);

    Object.keys(categories).forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      filterMain.appendChild(opt);
    });
  }

  function populateSubFilter(mainValue) {
    if (!filterSub) return;
    filterSub.innerHTML = "";
    const all = document.createElement("option");
    all.value = "All";
    all.textContent = "All";
    filterSub.appendChild(all);

    // If main is specific, only show its subs (if any)
    if (mainValue && mainValue !== "All") {
      const subs = categories[mainValue] || [];
      subs.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.textContent = sub;
        filterSub.appendChild(opt);
      });
      // If no subs exist, keep only "All"
      return;
    }

    // Main = All => show all subs across categories (unique)
    const allSubs = new Set();
    Object.values(categories).forEach(list => (list || []).forEach(s => allSubs.add(s)));
    Array.from(allSubs).sort().forEach(sub => {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      filterSub.appendChild(opt);
    });
  }

  populateMainFilter();
  populateSubFilter("All");

  if (filterMain) {
    filterMain.addEventListener("change", () => {
      populateSubFilter(filterMain.value);
      if (filterSub) filterSub.value = "All";
      render();
    });
  }
  if (filterSub) filterSub.addEventListener("change", render);
  if (filterSearch) filterSearch.addEventListener("input", render);

  // =========================
  // Recurring logic (Option C)
  // recurring: { startYear, startMonth, endYear|null, endMonth|null }
  // =========================
  function monthIndexAbs(year, month) {
    return Number(year) * 12 + Number(month);
  }

  // Visible month entries built from stored data + recurring rules
  function getMonthEntries(year, month) {
    const targetAbs = monthIndexAbs(year, month);
    const entries = [];

    Object.keys(data).forEach(sourceKey => {
      const arr = data[sourceKey];
      if (!Array.isArray(arr)) return;

      arr.forEach((expense, idx) => {
        if (!expense) return;

        if (!expense.recurring) {
          if (sourceKey === `${year}-${month}`) {
            entries.push({ expense, sourceKey, sourceIndex: idx, isGenerated: false });
          }
          return;
        }

        const r = expense.recurring;
        const startAbs = monthIndexAbs(r.startYear, r.startMonth);
        const hasEnd = r.endYear !== null && r.endMonth !== null;
        const endAbs = hasEnd ? monthIndexAbs(r.endYear, r.endMonth) : Infinity;

        if (targetAbs >= startAbs && targetAbs <= endAbs) {
          const isGenerated = targetAbs !== startAbs;
          entries.push({ expense, sourceKey, sourceIndex: idx, isGenerated });
        }
      });
    });

    return entries;
  }

  // =========================
  // CRUD
  // =========================
  window.addExpense = function () {
    const main = mainCategory?.value;
    if (!main) return;

    const subs = categories[main] || [];
    const sub = subs.length > 0 ? (subCategory?.value || null) : null;

    const amount = parseFloat(document.getElementById("amount")?.value || "");
    const note = document.getElementById("note")?.value || "";
    const recurringChecked = !!document.getElementById("recurring")?.checked;

    if (!Number.isFinite(amount) || amount <= 0) return;

    const key = `${currentYear}-${currentMonth}`;
    if (!Array.isArray(data[key])) data[key] = [];

    const expense = { main, sub, amount, note };

    if (recurringChecked) {
      expense.recurring = {
        startYear: Number(currentYear),
        startMonth: Number(currentMonth),
        endYear: null,
        endMonth: null
      };
    }

    data[key].push(expense);
    localStorage.setItem("budgetDataV2", JSON.stringify(data));

    const amountEl = document.getElementById("amount");
    const noteEl = document.getElementById("note");
    const recEl = document.getElementById("recurring");
    if (amountEl) amountEl.value = "";
    if (noteEl) noteEl.value = "";
    if (recEl) recEl.checked = false;

    render();
  };

  window.deleteExpense = function (index) {
    const entry = currentVisibleEntries[index];
    if (!entry) return;

    const arr = data[entry.sourceKey];
    if (!Array.isArray(arr)) return;

    arr.splice(entry.sourceIndex, 1);
    localStorage.setItem("budgetDataV2", JSON.stringify(data));
    render();
  };

  window.editExpense = function (index) {
    const entry = currentVisibleEntries[index];
    if (!entry) return;

    const item = entry.expense;

    if (mainCategory) mainCategory.value = item.main;
    updateAddSubcategories();
    if (item.sub && subCategory && subCategory.style.display !== "none") subCategory.value = item.sub;

    const amountEl = document.getElementById("amount");
    const noteEl = document.getElementById("note");
    const recEl = document.getElementById("recurring");

    if (amountEl) amountEl.value = item.amount;
    if (noteEl) noteEl.value = item.note || "";
    if (recEl) recEl.checked = !!item.recurring;

    // remove old record; user re-adds after editing
    window.deleteExpense(index);
  };

  window.stopRecurring = function (index) {
    const entry = currentVisibleEntries[index];
    if (!entry) return;

    const exp = entry.expense;
    if (!exp.recurring) return;

    exp.recurring.endYear = Number(currentYear);
    exp.recurring.endMonth = Number(currentMonth);

    localStorage.setItem("budgetDataV2", JSON.stringify(data));
    render();
  };

  // =========================
  // Charts
  // =========================
  let categoryChart = null;
  function drawCategoryChart(grouping, groupingMeta) {
    const canvas = document.getElementById("chart");
    if (!canvas || typeof Chart === "undefined") return;

    if (categoryChart) categoryChart.destroy();

    const labelsRaw = Object.keys(grouping);
    const values = labelsRaw.map(k => grouping[k] || 0);
    const total = values.reduce((a, b) => a + b, 0);

    if (!total) {
      categoryChart = new Chart(canvas, {
        type: "doughnut",
        data: { labels: ["No data"], datasets: [{ data: [1] }] },
        options: { plugins: { legend: { display: true } }, animation: false }
      });
      return;
    }

    const percents = values.map(v => (v / total) * 100);
    const labels = labelsRaw.map((name, i) => `${name} (${percents[i].toFixed(1)}%)`);

    const colors = labelsRaw.map(label => {
      if (CATEGORY_COLORS[label]) return CATEGORY_COLORS[label];
      const parent = groupingMeta?.[label] || getMainCategoryFromSub(label);
      return CATEGORY_COLORS[parent] || "#007aff";
    });

    categoryChart = new Chart(canvas, {
      type: "doughnut",
      data: { labels, datasets: [{ data: percents, backgroundColor: colors }] },
      options: {
        animation: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const rawLabel = labelsRaw[ctx.dataIndex];
                const pct = percents[ctx.dataIndex];
                const eur = values[ctx.dataIndex];
                return `${rawLabel}: ${pct.toFixed(1)}% (${fmtEUR(eur)})`;
              }
            }
          }
        }
      }
    });
  }

  let monthlyChart = null;
  function drawMonthlyComparison(compare) {
    const canvas = document.getElementById("monthlyChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (monthlyChart) monthlyChart.destroy();

    const mainCats = Object.keys(categories);

    if (compare === "Total") {
      const datasets = mainCats.map(cat => {
        const points = months.map((_, monthIndex) => {
          const entries = getMonthEntries(currentYear, monthIndex);
          return entries
            .filter(e => e.expense.main === cat)
            .reduce((sum, e) => sum + (Number(e.expense.amount) || 0), 0);
        });

        return { label: cat, data: points, backgroundColor: CATEGORY_COLORS[cat] || "#007aff" };
      });

      monthlyChart = new Chart(canvas, {
        type: "bar",
        data: { labels: months, datasets },
        options: {
          animation: false,
          responsive: true,
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true }
          },
          plugins: {
            legend: { display: true, position: "bottom" },
            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtEUR(ctx.raw)}` } }
          }
        }
      });
      return;
    }

    const totals = months.map((_, monthIndex) => {
      const entries = getMonthEntries(currentYear, monthIndex);
      return entries
        .filter(e => e.expense.main === compare)
        .reduce((sum, e) => sum + (Number(e.expense.amount) || 0), 0);
    });

    monthlyChart = new Chart(canvas, {
      type: "bar",
      data: { labels: months, datasets: [{ label: compare, data: totals, backgroundColor: CATEGORY_COLORS[compare] || "#007aff" }] },
      options: {
        animation: false,
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => fmtEUR(ctx.raw) } }
        },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // =========================
  // Backup reminder banner (monthly)
  // =========================
  function hideBackupBanner() {
    const b = document.getElementById("backupBanner");
    if (b) b.style.display = "none";
  }

  function showBackupBanner(text) {
    const b = document.getElementById("backupBanner");
    const t = document.getElementById("backupBannerText");
    const saveBtn = document.getElementById("backupNowBtn");
    const dismissBtn = document.getElementById("backupDismissBtn");

    if (!b || !t || !saveBtn || !dismissBtn) return;

    t.textContent = text;

    saveBtn.onclick = () => window.saveBackup();
    dismissBtn.onclick = () => {
      localStorage.setItem("backupDismissedFor", `${currentYear}-${currentMonth}`);
      hideBackupBanner();
    };

    b.style.display = "block";
  }

  function checkBackupReminder() {
    const dismissed = localStorage.getItem("backupDismissedFor");
    const dismissedKey = `${currentYear}-${currentMonth}`;
    if (dismissed === dismissedKey) return;

    const last = localStorage.getItem("lastBackupAt");
    if (!last) {
      showBackupBanner("💾 Quick reminder: you haven’t saved a backup yet this month.");
      return;
    }

    const d = new Date(last);
    const sameMonth = d.getFullYear() === Number(currentYear) && d.getMonth() === Number(currentMonth);
    if (!sameMonth) {
      showBackupBanner("💾 Friendly reminder: save a monthly backup for your archive.");
    }
  }

  // =========================
  // Backup Save/Load
  // =========================
  window.saveBackup = function () {
    const payload = {
      app: "BudgetTracker",
      version: 3,
      exportedAt: new Date().toISOString(),
      budgetDataV2: data
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `budget_backup_${currentYear}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    localStorage.setItem("lastBackupAt", new Date().toISOString());
    hideBackupBanner();
  };

  window.handleBackupFile = function (event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || parsed.app !== "BudgetTracker" || typeof parsed.budgetDataV2 !== "object") {
          alert("This backup file doesn't look valid for this app.");
          return;
        }

        const ok = confirm(
          "Load this backup and REPLACE your current data?\n\n" +
          "This cannot be undone unless you saved a backup first."
        );
        if (!ok) return;

        data = parsed.budgetDataV2 || {};
        localStorage.setItem("budgetDataV2", JSON.stringify(data));
        render();

        localStorage.setItem("lastBackupAt", new Date().toISOString());
        hideBackupBanner();

        alert("Backup loaded successfully.");
      } catch {
        alert("Could not read that JSON file. Make sure it’s a valid backup.");
      } finally {
        if (event?.target) event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // =========================
  // Swipe-to-reveal (Edit/Delete)
  // =========================
  function enableSwipe() {
    const items = document.querySelectorAll(".swipe-item");

    function closeAll(exceptEl = null) {
      items.forEach(it => {
        const content = it.querySelector(".swipe-content");
        if (!content) return;
        if (exceptEl && it === exceptEl) return;
        content.style.transform = "translateX(0px)";
        it.dataset.open = "0";
      });
    }

    document.addEventListener("touchstart", (e) => {
      const inside = e.target.closest?.(".swipe-item");
      if (!inside) closeAll(null);
    }, { passive: true });

    items.forEach(item => {
      const content = item.querySelector(".swipe-content");
      if (!content) return;
      if (item.dataset.swipeBound === "1") return;
      item.dataset.swipeBound = "1";

      let startX = 0;
      let dragging = false;
      const maxSwipe = 184; // 2 buttons x ~92

      item.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
        dragging = true;
        closeAll(item);
      }, { passive: true });

      item.addEventListener("touchmove", (e) => {
        if (!dragging) return;
        const currentX = e.touches[0].clientX;
        const dx = currentX - startX;

        const translate = Math.max(-maxSwipe, Math.min(0, dx));
        content.style.transform = `translateX(${translate}px)`;
      }, { passive: true });

      item.addEventListener("touchend", () => {
        dragging = false;

        let x = 0;
        try {
          const m = new DOMMatrixReadOnly(getComputedStyle(content).transform);
          x = m.m41 || 0;
        } catch { x = 0; }

        if (x < -maxSwipe / 2) {
          content.style.transform = `translateX(${-maxSwipe}px)`;
          item.dataset.open = "1";
        } else {
          content.style.transform = "translateX(0px)";
          item.dataset.open = "0";
        }
      });
    });
  }

  // =========================
  // PDF Export (annual, chart page, landscape)
  // =========================
  window.exportPDF = function () {
    const year = Number(currentYear);
    const title = `Annual Budget Report - ${year}`;
    const mainCats = Object.keys(categories);

    const matrix = {};
    mainCats.forEach(cat => (matrix[cat] = Array(12).fill(0)));

    const monthlyTotals = Array(12).fill(0);
    let yearlyTotal = 0;

    for (let m = 0; m < 12; m++) {
      const entries = getMonthEntries(year, m);
      entries.forEach(({ expense }) => {
        const amt = Number(expense.amount) || 0;
        yearlyTotal += amt;
        monthlyTotals[m] += amt;
        if (!matrix[expense.main]) matrix[expense.main] = Array(12).fill(0);
        matrix[expense.main][m] += amt;
      });
    }

    if (yearlyTotal === 0) {
      alert("No expenses recorded for this year.");
      return;
    }

    const categoryTotals = {};
    mainCats.forEach(cat => { categoryTotals[cat] = matrix[cat].reduce((a, b) => a + b, 0); });

    let categoryRows = "";
    mainCats.forEach(cat => {
      categoryRows += `
        <tr>
          <td>${cat}</td>
          <td style="text-align:right">${fmtEUR(categoryTotals[cat] || 0)}</td>
        </tr>
      `;
    });

    const monthlyRow = monthlyTotals.map(t => `<td style="text-align:right">${fmtEUR(t)}</td>`).join("");

    let matrixRows = "";
    mainCats.forEach(cat => {
      matrixRows += `<tr><td>${cat}</td>`;
      for (let m = 0; m < 12; m++) {
        matrixRows += `<td style="text-align:right">${fmtEUR(matrix[cat][m] || 0)}</td>`;
      }
      matrixRows += `</tr>`;
    });

    const chartLabels = months;
    const chartDatasets = mainCats.map(cat => ({
      label: cat,
      data: matrix[cat].map(v => Number(v || 0)),
      backgroundColor: CATEGORY_COLORS[cat] || "#007aff"
    }));

    const printWindow = window.open("", "", "width=1100,height=900");

    printWindow.document.write(`
      <html>
      <head>
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 40px;
            color: #000;
          }
          h1 { text-align: center; margin-bottom: 6px; }
          h2 { margin-top: 26px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 12px;
          }
          th, td { padding: 6px; border: 1px solid #ddd; }
          th { background: #f2f2f2; }
          .total {
            font-size: 18px;
            font-weight: bold;
            text-align: right;
            margin-top: 18px;
          }
          .chart-wrap {
            margin-top: 12px;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 10px;
          }
          .footer {
            margin-top: 28px;
            font-size: 12px;
            text-align: center;
            color: #666;
          }

          @page { size: A4 landscape; margin: 15mm; }
          .page-1 { max-width: 900px; margin: 0 auto; }
          .page-2 { page-break-before: always; }
          .landscape { height: 70vh; }

          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        </style>
      </head>
      <body>

        <div class="page-1">
          <h1>${title}</h1>

          <h2>Yearly Category Summary</h2>
          <table>
            <tr>
              <th>Main Category</th>
              <th style="text-align:right">Total</th>
            </tr>
            ${categoryRows}
          </table>

          <h2>Monthly Totals</h2>
          <table>
            <tr>${months.map(m => `<th>${m}</th>`).join("")}</tr>
            <tr>${monthlyRow}</tr>
          </table>

          <h2>Category by Month Breakdown</h2>
          <table>
            <tr>
              <th>Category</th>
              ${months.map(m => `<th>${m}</th>`).join("")}
            </tr>
            ${matrixRows}
          </table>

          <div class="total">Yearly Total: ${fmtEUR(yearlyTotal)}</div>
          <div class="footer">Generated on ${new Date().toLocaleDateString()}</div>
        </div>

        <div class="page-2">
          <h2>Year Chart (Monthly breakdown by main category)</h2>
          <div class="chart-wrap landscape">
            <canvas id="yearStackedChart" height="220"></canvas>
          </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
          const labels = ${JSON.stringify(chartLabels)};
          const datasets = ${JSON.stringify(chartDatasets)};

          const ctx = document.getElementById("yearStackedChart").getContext("2d");
          new Chart(ctx, {
            type: "bar",
            data: { labels, datasets },
            options: {
              animation: false,
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
              },
              plugins: {
                legend: { display: true, position: "bottom" },
                tooltip: { enabled: false }
              }
            }
          });

          setTimeout(() => {
            window.focus();
            window.print();
          }, 1200);
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  // =========================
  // Helpers: apply filters + search
  // =========================
  function applyListFilters(entries) {
    const mainVal = filterMain?.value || "All";
    const subVal = filterSub?.value || "All";
    const q = (filterSearch?.value || "").trim().toLowerCase();

    return entries.filter(e => {
      const exp = e.expense;

      if (mainVal !== "All" && exp.main !== mainVal) return false;
      if (subVal !== "All") {
        if (!exp.sub || exp.sub !== subVal) return false;
      }

      if (q) {
        const note = (exp.note || "").toLowerCase();
        if (!note.includes(q)) return false;
      }

      return true;
    });
  }

  function updateDisplayedTotal() {
    if (!expensesTotalEl) return;
    const total = currentVisibleEntries.reduce((sum, e) => sum + (Number(e.expense.amount) || 0), 0);
    expensesTotalEl.textContent = `Total: ${fmtEUR(total)}`;
  }

  // =========================
  // Render UI
  // =========================
  function render() {
    const list = document.getElementById("expenseList");
    if (!list) return;

    const chartView = chartViewEl?.value || "main";
    const compare = compareCategory?.value || "Total";

    // All entries for the month (used for charts)
    const allEntries = getMonthEntries(currentYear, currentMonth);

    // Filtered entries (used for list + total)
    currentVisibleEntries = applyListFilters(allEntries);

    // Build list
    list.innerHTML = "";
    currentVisibleEntries.forEach((entry, visibleIndex) => {
      const item = entry.expense;

      const row = document.createElement("div");
      row.className = "expense-item swipe-item";
      row.dataset.open = "0";

      row.innerHTML = `
        <div class="swipe-actions">
          <button class="editBtn" type="button" onclick="editExpense(${visibleIndex})">Edit</button>
          <button class="deleteBtn" type="button" onclick="deleteExpense(${visibleIndex})">Delete</button>
        </div>

        <div class="swipe-content">
          <strong>${catLabel(item.main, item.sub)}</strong><br>
          <span class="amount">-${fmtEUR(item.amount)}</span><br>
          <span class="note">${item.note || ""}</span>

          ${item.recurring ? `
            <div class="chip">🔁 Monthly</div>
            <div style="margin-top:6px;">
              <button type="button" onclick="stopRecurring(${visibleIndex})">Stop Recurring</button>
            </div>
          ` : ""}
        </div>
      `;

      list.appendChild(row);
    });

    // Total for currently displayed (filtered) list
    updateDisplayedTotal();

    // Build chart grouping from ALL entries (unfiltered)
    const grouping = {};
    const groupingMeta = {};
    allEntries.forEach((entry) => {
      const item = entry.expense;
      const groupKey = (chartView === "main") ? item.main : (item.sub || item.main);
      grouping[groupKey] = (grouping[groupKey] || 0) + (Number(item.amount) || 0);
      if (chartView === "sub" && item.sub) groupingMeta[item.sub] = item.main;
    });

    drawCategoryChart(grouping, groupingMeta);
    drawMonthlyComparison(compare);

    // enable swipe after DOM is built
    enableSwipe();

    // backup reminder check
    checkBackupReminder();
  }

  // First render
  render();
});
