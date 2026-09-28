const BANK_EXPENSES_DETAIL_PATH = "../data/processed/expenses/bank-statements/bank-expenses-from-csv.csv";
const VENDOR_MAPPING_PATH = "../data/processed/vendor-category-mapping.csv";
const STORAGE_ROWS_KEY = "budgetApp.rows.v1";
const STORAGE_CATEGORIES_KEY = "budgetApp.categories.v1";
const STORAGE_META_KEY = "budgetApp.meta.v1";
const STORAGE_ROWS_CASHFLOW_KEY = "budgetApp.rows.cashflow.v1";
const STORAGE_ROWS_BUDGET_KEY = "budgetApp.rows.budget.v1";
const STORAGE_PROFILE_KEY = "budgetApp.profile.v1";
const STORAGE_OUTLIERS_KEY = "budgetApp.outliers.v1";
const STORAGE_VENDOR_MAPPING_KEY = "budgetApp.vendorMapping.v1";
const STORAGE_CATEGORY_ACTUAL_KEY = "budgetApp.categoryActualByMonth.v2";

const OUTLIER_THRESHOLD = 10000; // Flag transactions >= $10,000

const state = {
  rows: [],
  route: "dashboard",
  categoryActualByMonth: {}, // { "2026-07": { food: 1847.50, gas: 150.00, ... } }
  categoryVarianceByMonth: {}, // { "2026-07": { food: { budget: 1500, actual: 1847.50, variance: -347.50 }, ... } }
  budgetByCategory: {},
  budgetCategories: {}, // { "Groceries": { category: "Groceries", monthly: "$1,500.00", annual: "$18,000.00" }, ... }
  vendorMapping: {}, // { vendorPattern: budgetCategory, ... }
  selectedMonth: "",
  selectedYear: "",
  bankCardInfoByMonth: {},
  outliersByMonth: {},
  profile: null,
  meta: {
    source: "",
    importedAt: "",
    calcMode: "cashflow",
  },
};

const ROUTES = ["dashboard", "months", "pipeline", "profile", "notes"];

const DEFAULT_PROFILE = {
  name: "",
  bankResource: "",
  baselineBudget: 8812.24,
  preferredMode: "cashflow",
  monthlySavingsGoal: 0,
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim();
    });
    return row;
  });
}

async function readTextFromUrl(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      return await res.text();
    }
  } catch (_) {
    // Continue to XHR fallback for local-file browser differences.
  }

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = () => {
      // In file mode some browsers report status 0 on successful load.
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.responseText || "");
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network/XHR error"));
    xhr.send();
  });
}

function persistComputedState(metaOverride) {
  if (metaOverride && typeof metaOverride === "object") {
    state.meta = {
      ...state.meta,
      ...metaOverride,
    };
  }

  try {
    localStorage.setItem(STORAGE_ROWS_KEY, JSON.stringify(state.rows || []));
    localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(state.categoryActualByMonth || {}));
    localStorage.setItem(STORAGE_META_KEY, JSON.stringify(state.meta || {}));
    localStorage.setItem(STORAGE_OUTLIERS_KEY, JSON.stringify(state.outliersByMonth || {}));
  } catch (_) {
    // Ignore storage failures (private mode / blocked storage).
  }
}

function persistModeRows(cashflowRows, budgetRows) {
  try {
    localStorage.setItem(STORAGE_ROWS_CASHFLOW_KEY, JSON.stringify(cashflowRows || []));
    localStorage.setItem(STORAGE_ROWS_BUDGET_KEY, JSON.stringify(budgetRows || []));
  } catch (_) {
    // Ignore storage failures.
  }
}

function loadSavedRowsForMode(mode) {
  try {
    const key = mode === "budget" ? STORAGE_ROWS_BUDGET_KEY : STORAGE_ROWS_CASHFLOW_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || !rows.length) return [];
    return rows.sort((a, b) => String(a.month || "").localeCompare(String(b.month || "")));
  } catch (_) {
    return [];
  }
}

function applySavedModeRows(mode) {
  const rows = loadSavedRowsForMode(mode);
  if (!rows.length) return false;
  state.rows = normalizeRowsForMode(rows, mode);
  state.meta = {
    ...state.meta,
    calcMode: mode === "budget" ? "budget" : "cashflow",
  };
  renderAll();
  return true;
}

function normalizeRowsForMode(rows, mode) {
  const normalizedMode = mode === "budget" ? "budget" : "cashflow";
  return (rows || []).map((r) => {
    const bank = toNum(r.bankExpensesObserved);
    const card = toNum(r.cardPurchasesObserved);
    const income = toNum(r.incomeTotalForMonth || r.incomeObserved);
    const next = { ...r };

    if (normalizedMode === "cashflow") {
      next.knownExpensesTotal = Number(bank.toFixed(2));
    } else {
      next.knownExpensesTotal = Number((bank + card).toFixed(2));
    }
    next.netObservedMinusKnownExpenses = Number((income - toNum(next.knownExpensesTotal)).toFixed(2));
    return next;
  });
}

function getKnownForMonthFromModeRows(month, mode) {
  if (!month) return null;
  const normalizedMode = mode === "budget" ? "budget" : "cashflow";

  const activeMode = state.meta.calcMode === "budget" ? "budget" : "cashflow";
  if (activeMode === normalizedMode) {
    const row = state.rows.find((r) => String(r.month || "") === String(month));
    if (!row) return null;
    const normalized = normalizeRowsForMode([row], normalizedMode)[0];
    return toNum(normalized?.knownExpensesTotal);
  }

  const savedRows = loadSavedRowsForMode(normalizedMode);
  const savedRow = savedRows.find((r) => String(r.month || "") === String(month));
  if (!savedRow) return null;
  const normalized = normalizeRowsForMode([savedRow], normalizedMode)[0];
  return toNum(normalized?.knownExpensesTotal);
}

function renderModeDifferenceCallout(month) {
  const note = document.getElementById("mode-diff-note");
  if (!note) return;

  const modeInput = document.getElementById("calc-mode-input");
  const activeMode = (modeInput?.value || state.meta.calcMode || "cashflow") === "budget" ? "budget" : "cashflow";
  const modeLine = activeMode === "budget"
    ? "Showing Budget mode: Known Expenses = card purchases + bank expenses excluding card-payment transfers."
    : "Showing Cashflow mode: Known Expenses = all bank debits (including card payments).";

  const cashflowKnown = getKnownForMonthFromModeRows(month, "cashflow");
  const budgetKnown = getKnownForMonthFromModeRows(month, "budget");

  if (!Number.isFinite(cashflowKnown) || !Number.isFinite(budgetKnown)) {
    note.classList.remove("mode-diff-positive", "mode-diff-negative");
    note.innerHTML = `<span class="mode-diff-value">${modeLine}</span><br>Mode reconciliation appears after a pipeline import is available for both modes.`;
    return;
  }

  const diff = Number((cashflowKnown - budgetKnown).toFixed(2));
  const absDiff = Math.abs(diff);
  note.classList.remove("mode-diff-positive", "mode-diff-negative");

  if (absDiff < 0.01) {
    note.innerHTML = `<span class="mode-diff-value">${modeLine}</span><br>${month}: <span class="mode-diff-value">No timing difference.</span> Cashflow and Budget known expenses are aligned.`;
    return;
  }

  if (diff > 0) {
    note.classList.add("mode-diff-positive");
    note.innerHTML = `<span class="mode-diff-value">${modeLine}</span><br>${month}: Cashflow known expenses are <span class="mode-diff-value">${money.format(absDiff)} higher</span> than Budget due to card payment timing (typically prior-cycle card balances being paid this month).`;
    return;
  }

  note.classList.add("mode-diff-negative");
  note.innerHTML = `<span class="mode-diff-value">${modeLine}</span><br>${month}: Budget known expenses are <span class="mode-diff-value">${money.format(absDiff)} higher</span> than Cashflow for this month.`;
}

function tryRestoreComputedState() {
  try {
    const rawRows = localStorage.getItem(STORAGE_ROWS_KEY);
    if (!rawRows) return false;
    const parsedRows = JSON.parse(rawRows);
    if (!Array.isArray(parsedRows) || !parsedRows.length) return false;

    state.rows = parsedRows.sort((a, b) => String(a.month || "").localeCompare(String(b.month || "")));

    const rawCategories = localStorage.getItem(STORAGE_CATEGORIES_KEY);
    state.categoryActualByMonth = rawCategories ? JSON.parse(rawCategories) : {};

    const rawMeta = localStorage.getItem(STORAGE_META_KEY);
    state.meta = rawMeta ? JSON.parse(rawMeta) : { source: "", importedAt: "", calcMode: "cashflow" };

    const rawOutliers = localStorage.getItem(STORAGE_OUTLIERS_KEY);
    state.outliersByMonth = rawOutliers ? JSON.parse(rawOutliers) : {};

    return true;
  } catch (_) {
    return false;
  }
}

function sourceLabel(source) {
  if (source === "pipeline-import") return "Pipeline import";
  if (source === "snapshot-default") return "Snapshot default file";
  if (source === "snapshot-csv") return "Snapshot CSV upload";
  if (source === "embedded-default") return "Embedded fallback data";
  return "Data source";
}

function formatImportedAt(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }

  out.push(cur);
  return out;
}

function toNum(v) {
  if (!v) return 0;
  // Remove dollar signs, commas, and other currency symbols
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normCategory(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "other";
  if (s.includes("grocer") || s === "food" || s.includes("supermarket")) return "food";
  if (s.includes("food & drink") || s.includes("restaurant") || s.includes("dining")) return "restaurants";
  if (s.includes("entertain") || s.includes("movie") || s.includes("stream") || s.includes("music")) return "entertainment";
  if (s.includes("travel") || s.includes("airline") || s.includes("hotel") || s.includes("lodging")) return "travel";
  if (s.includes("transport") || s.includes("uber") || s.includes("lyft") || s.includes("parking") || s.includes("toll")) return "transportation";
  if (s.includes("gas") || s.includes("fuel")) return "gas";
  if (s.includes("health") || s.includes("medical") || s.includes("pharmacy")) return "health";
  if (s.includes("bills") || s.includes("utilit") || s === "internet") return "utilities";
  if (s.includes("home") || s.includes("maint")) return "maint";
  if (s.includes("pool")) return "pool";
  if (s.includes("pest")) return "pest-control";
  if (s.includes("loan") || s.includes("mort")) return "loan-payment";
  if (s.includes("shopping") || s.includes("amazon") || s.includes("retail") || s.includes("department store")) return "shopping";
  if (s.includes("education") || s.includes("school") || s.includes("tuition")) return "education";
  if (s.includes("insurance")) return "insurance";
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "other";
}

function inferCardCategoryByDescription(desc) {
  const d = String(desc || "").toLowerCase();
  if (!d) return "card-other";

  if (d.includes("walmart") || d.includes("publix") || d.includes("trader joe") || d.includes("whole foods") || d.includes("aldi") || d.includes("costco") || d.includes("sam's club")) return "food";
  if (d.includes("restaurant") || d.includes("cafe") || d.includes("coffee") || d.includes("starbucks") || d.includes("mcdonald") || d.includes("chipotle") || d.includes("chick-fil-a") || d.includes("doordash") || d.includes("uber eats")) return "restaurants";
  if (d.includes("netflix") || d.includes("spotify") || d.includes("hulu") || d.includes("disney") || d.includes("cinema") || d.includes("movie") || d.includes("amc")) return "entertainment";
  if (d.includes("amazon") || d.includes("target") || d.includes("best buy") || d.includes("etsy") || d.includes("ebay")) return "shopping";
  if (d.includes("airlines") || d.includes("delta") || d.includes("united") || d.includes("southwest") || d.includes("hotel") || d.includes("marriott") || d.includes("hilton") || d.includes("airbnb")) return "travel";
  if (d.includes("uber") || d.includes("lyft") || d.includes("shell") || d.includes("exxon") || d.includes("chevron") || d.includes("parking") || d.includes("sunpass")) return "transportation";
  if (d.includes("walgreens") || d.includes("cvs") || d.includes("pharmacy") || d.includes("doctor") || d.includes("dental")) return "health";
  if (d.includes("electric") || d.includes("water") || d.includes("internet") || d.includes("comcast") || d.includes("att") || d.includes("verizon") || d.includes("t-mobile")) return "utilities";

  return "card-other";
}

function inferBankCategory(desc) {
  const d = String(desc || "").toLowerCase();
  if (d.includes("cox communications")) return "utilities";
  if (d.includes("gainesville regional utilities") || d.includes(" gru")) return "utilities";
  if (d.includes("fcu") && d.includes("loan")) return "loan-payment";
  if (d.includes("arrow exterminators")) return "pest-control";
  if (d.includes("pool service") || d.includes("swim state")) return "pool";
  if (d.includes("davis gas")) return "gas";
  if (d.includes("climate first")) return "loan-payment";
  return "bank-other";
}

function addCategory(map, month, category, amount) {
  if (!month || !amount) return;
  if (!map[month]) map[month] = {};
  if (!map[month][category]) map[month][category] = 0;
  map[month][category] += amount;
}

function normalizeChartCategoryKey(category) {
  const c = String(category || "").trim().toLowerCase();
  if (!c) return "uncategorized";
  if (c === "bank-other" || c === "card-other" || c === "other") return "uncategorized";
  return c;
}

function categoryDisplayName(category) {
  const c = normalizeChartCategoryKey(category);
  const map = {
    food: "Food",
    restaurants: "Restaurants",
    entertainment: "Entertainment",
    shopping: "Shopping",
    travel: "Travel",
    transportation: "Transportation",
    utilities: "Utilities",
    health: "Health",
    gas: "Gas",
    maint: "Maintenance",
    pool: "Pool",
    "pest-control": "Pest Control",
    "loan-payment": "Loan Payment",
    insurance: "Insurance",
    education: "Education",
    uncategorized: "Uncategorized",
  };
  if (map[c]) return map[c];
  return c.split("-").filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function mergeForChart(rawMap) {
  const merged = {};
  Object.keys(rawMap || {}).forEach((k) => {
    const nk = normalizeChartCategoryKey(k);
    merged[nk] = toNum(merged[nk]) + toNum(rawMap[k]);
  });
  return merged;
}

function parseBudgetCategoryCsv(csvText) {
  const rows = parseCsv(csvText);
  const out = {};
  rows.forEach((r) => {
    const cat = normCategory(r.name || r.category || r.item);
    const amt = toNum(r.budgetAmount || r.amount || r.monthly_amount);
    if (!amt) return;
    out[cat] = amt;
  });
  return out;
}


async function loadVendorMapping() {
  try {
    const text = await readTextFromUrl(VENDOR_MAPPING_PATH);
    const rows = parseCsv(text);
    const mapping = {};

    rows.forEach((r) => {
      // Look for "Category" or similar in Column A
      let category = null;
      for (const key of Object.keys(r)) {
        const k = key.trim().toLowerCase();
        // Match headers like "Category", "Budget Category", "budgetcategory"
        if (k === 'category' || k.includes('category')) {
          const val = String(r[key] || "").trim();
          if (val && val !== "SUM" && !val.startsWith("=")) {
            category = val;
            break;
          }
        }
      }
      
      // Look for "VENDOR" or similar in Column G
      let vendors = null;
      for (const key of Object.keys(r)) {
        const k = key.trim().toLowerCase();
        // Match headers like "VENDOR", "Vendor", "VENDOR PATTERNS", etc.
        if (k === 'vendor' || k.includes('vendor')) {
          const val = String(r[key] || "").trim();
          if (val && val.length > 0) {
            vendors = val;
            break;
          }
        }
      }

      if (!category || !vendors) return;

      // Split comma-delimited vendors and normalize each
      vendors
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
        .forEach((vendor) => {
          // Normalize spaces and convert to lowercase for matching
          const normalized = vendor.replace(/\s+/g, ' ').toLowerCase();
          if (!mapping[normalized]) {
            mapping[normalized] = category;
          }
        });
    });

    state.vendorMapping = mapping;
    console.log("[VENDOR MAPPING] Loaded", Object.keys(mapping).length, "vendor patterns");
    Object.keys(mapping).slice(0, 3).forEach(k => {
      console.log(`  "${k}" → "${mapping[k]}"`);
    });
    try {
      localStorage.setItem(STORAGE_VENDOR_MAPPING_KEY, JSON.stringify(mapping));
    } catch (_) {
      // Ignore storage failures
    }
  } catch (e) {
    console.warn("Could not load vendor mapping; continuing with empty mapping", e);
    state.vendorMapping = {};
  }
}

async function loadBudgetCategories() {
  try {
    // Try to load budget v2 file
    const budgetPath = VENDOR_MAPPING_PATH.replace('vendor-category-mapping.csv', 'budget-categories.csv');
    const text = await readTextFromUrl(budgetPath);
    const rows = parseCsv(text);
    const categories = {};

    rows.forEach((r) => {
      // Extract Budget Category (Column A)
      let budgetCategory = null;
      for (const key of Object.keys(r)) {
        const k = key.trim().toLowerCase();
        if (k.includes('budget') && k.includes('category')) {
          budgetCategory = String(r[key] || "").trim();
          break;
        }
      }

      if (!budgetCategory) return;

      // Extract Monthly amount (Column B)
      let monthly = "0";
      for (const key of Object.keys(r)) {
        const k = key.trim().toLowerCase();
        if (k === 'monthly' || k === 'monthly ') {
          monthly = String(r[key] || "0").trim();
          break;
        }
      }

      // Extract Annual amount (Column E)
      let annual = "0";
      for (const key of Object.keys(r)) {
        const k = key.trim().toLowerCase();
        if (k === 'annual' || k === 'annual ') {
          annual = String(r[key] || "0").trim();
          break;
        }
      }

      categories[budgetCategory] = {
        category: budgetCategory,
        monthly: monthly,
        annual: annual
      };
    });

    state.budgetCategories = categories;
    console.log("[BUDGET CATEGORIES] Loaded", Object.keys(categories).length, "budget categories");
    Object.keys(categories).slice(0, 3).forEach(k => {
      console.log(`  "${k}" → monthly: ${categories[k].monthly}, annual: ${categories[k].annual}`);
    });

    // Populate budgetByCategory for chart rendering
    // Extract monthly amounts and convert to numbers for the chart
    const budgetByCategory = {};
    Object.entries(categories).forEach(([catName, catData]) => {
      const monthlyStr = String(catData.monthly || "0").trim();
      const monthlyNum = toNum(monthlyStr);
      if (monthlyNum > 0) {
        // Use category name as-is for now (can be normalized later if needed)
        budgetByCategory[catName] = monthlyNum;
      }
    });
    
    // Merge with any existing defaults, with loaded data taking precedence
    state.budgetByCategory = { ...state.budgetByCategory, ...budgetByCategory };
    console.log("[BUDGET BY CATEGORY] Updated from loaded file:", Object.keys(budgetByCategory).length, "categories");
  } catch (e) {
    console.warn("Could not load budget categories; continuing without budget data", e);
    state.budgetCategories = {};
  }
}

function findCategoryByVendor(merchantName) {
  if (!merchantName) return null;
  const merchant = String(merchantName).trim().toLowerCase();
  if (!merchant) return null;

  // Normalize spaces for matching (collapse multiple spaces to single space)
  const merchantNormalized = merchant.replace(/\s+/g, ' ');

  // Try exact matches first
  if (state.vendorMapping[merchantNormalized]) {
    return state.vendorMapping[merchantNormalized];
  }

  // Try partial matches (vendor name contains mapping key or vice versa)
  for (const [vendorPattern, category] of Object.entries(state.vendorMapping)) {
    // Also normalize the pattern for comparison
    const patternNormalized = vendorPattern.replace(/\s+/g, ' ');
    if (merchantNormalized.includes(patternNormalized) || patternNormalized.includes(merchantNormalized)) {
      console.log(`[MATCH] "${merchantName}" → "${category}" (pattern: "${vendorPattern}")`);
      return category;
    }
  }

  return null;
}

async function loadBankCardInfoByMonth() {
  try {
    const text = await readTextFromUrl(BANK_EXPENSES_DETAIL_PATH);
    const rows = parseCsv(text);
    const out = {};

    rows.forEach((r) => {
      const month = String(r.month || "").trim();
      const payee = String(r.payee || "");
      const amount = toNum(r.amount);
      if (!month || !amount) return;
      if (!isCardTransferDescription(payee)) return;

      if (!out[month]) out[month] = 0;
      out[month] += amount;
    });

    Object.keys(out).forEach((m) => {
      out[m] = Number(out[m].toFixed(2));
    });

    state.bankCardInfoByMonth = out;
  } catch (_) {
    state.bankCardInfoByMonth = {};
  }
}

function parseDateToMonth(dateValue) {
  if (!dateValue) return "";
  const s = String(dateValue).trim();
  if (!s) return "";

  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const m = mdy[1].padStart(2, "0");
    return `${mdy[3]}-${m}`;
  }

  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2]}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  }

  return "";
}

function isCardTransferDescription(desc) {
  const d = String(desc || "").toLowerCase();
  return (
    d.includes("payment to chase card") ||
    d.includes("chase credit crd autopay") ||
    d.includes("orig co name:chase credit crd")
  );
}

function ensureMonthBucket(map, month) {
  if (!map[month]) {
    map[month] = {
      month,
      incomeObserved: 0,
      incomeBackfill: 0,
      incomeTotalForMonth: 0,
      baselineExpenses: 0,
      cardPurchasesObserved: 0,
      bankExpensesObserved: 0,
      knownExpensesTotal: 0,
      netObservedMinusKnownExpenses: 0,
    };
  }
  return map[month];
}

function flagOutliersInTransaction(amount, desc, month) {
  const absAmount = Math.abs(amount);
  if (absAmount < OUTLIER_THRESHOLD) return null;

  if (!state.outliersByMonth[month]) {
    state.outliersByMonth[month] = [];
  }

  const outlier = {
    amount: absAmount,
    description: desc,
    isIncome: amount > 0,
    reason: `Large ${amount > 0 ? "income" : "expense"} (>${money.format(OUTLIER_THRESHOLD)})`,
  };

  state.outliersByMonth[month].push(outlier);
  console.log(`[OUTLIER] Flagged $${absAmount.toFixed(2)} in ${month}: ${desc}`);
  return outlier;
}

function buildSnapshotFromRawUploads(bankRows, cardRows1, cardRows2, baseline, calcMode) {
  const byMonth = {};
  const categoryByMonth = {}; // Track category-level actuals
  const mode = calcMode === "budget" ? "budget" : "cashflow";
  state.outliersByMonth = {}; // Reset outliers for this run
  console.log(`[BUILD] Starting snapshot with ${bankRows.length} bank rows, mode: ${mode}`);

  bankRows.forEach((r) => {
    const month = parseDateToMonth(r["Posting Date"] || r["Post Date"] || r["Transaction Date"] || r.Date);
    if (!month) return;

    const amount = toNum(r.Amount);
    if (!amount) return;

    const bucket = ensureMonthBucket(byMonth, month);
    const desc = r.Description || "";

    // Check for outliers first - if flagged, exclude from calculations
    const isOutlier = flagOutliersInTransaction(amount, desc, month);
    if (isOutlier) {
      console.log(`[SKIP] Excluding $${amount.toFixed(2)} from ${month} totals`);
      return; // Skip adding outlier to bucket
    }

    if (amount > 0) {
      console.log(`[INCOME] Adding $${amount.toFixed(2)} to ${month}`);
      bucket.incomeObserved += amount;
      return;
    }

    console.log(`[EXPENSE] Processing expense $${amount.toFixed(2)}`);

    if (mode === "cashflow" && isCardTransferDescription(desc)) {
      bucket.cardPurchasesObserved += Math.abs(amount);
      return;
    }

    if (mode === "budget" && isCardTransferDescription(desc)) {
      return;
    }

    // Track category-level actuals by vendor matching
    const vendorCategory = findCategoryByVendor(desc);
    const category = vendorCategory || inferBankCategory(desc) || "uncategorized";
    addCategory(categoryByMonth, month, category, Math.abs(amount));

    bucket.bankExpensesObserved += Math.abs(amount);
  });

  [cardRows1, cardRows2].forEach((cardRows) => {
    if (mode !== "budget") return;

    cardRows.forEach((r) => {
      const type = String(r.Type || "").toLowerCase();
      const amount = toNum(r.Amount);
      if (type !== "sale" || amount >= 0) return;

      const month = parseDateToMonth(r["Post Date"] || r["Transaction Date"] || r.Date);
      if (!month) return;

      const desc = r.Description || r.Merchant || r.Payee || "";

      // Check for outliers in credit card transactions too
      const isOutlier = flagOutliersInTransaction(amount, desc, month);
      if (isOutlier) {
        return; // Skip adding outlier to bucket
      }

      // Track category-level actuals by vendor matching
      const vendorCategory = findCategoryByVendor(desc);
      const category = vendorCategory || inferCardCategoryByDescription(desc) || "uncategorized";
      addCategory(categoryByMonth, month, category, Math.abs(amount));

      const bucket = ensureMonthBucket(byMonth, month);
      bucket.cardPurchasesObserved += Math.abs(amount);
    });
  });

  // Store category actuals in state
  state.categoryActualByMonth = categoryByMonth;

  const rows = Object.values(byMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => {
      r.incomeObserved = Number(r.incomeObserved.toFixed(2));
      r.cardPurchasesObserved = Number(r.cardPurchasesObserved.toFixed(2));
      r.bankExpensesObserved = Number(r.bankExpensesObserved.toFixed(2));
      r.baselineExpenses = Number(baseline.toFixed(2));
      r.incomeTotalForMonth = Number((r.incomeObserved + r.incomeBackfill).toFixed(2));
      if (mode === "cashflow") {
        r.knownExpensesTotal = Number(r.bankExpensesObserved.toFixed(2));
      } else {
        // Budget mode compares observed spend against baseline budget; do not add baseline into expenses.
        r.knownExpensesTotal = Number((r.cardPurchasesObserved + r.bankExpensesObserved).toFixed(2));
      }
      r.netObservedMinusKnownExpenses = Number((r.incomeTotalForMonth - r.knownExpensesTotal).toFixed(2));
      return r;
    });

  return rows;
}

function setStatus(msg) {
  document.getElementById("status-line").textContent = msg;
}

function normalizeProfile(raw) {
  const baseline = toNum(raw?.baselineBudget);
  const savings = toNum(raw?.monthlySavingsGoal);
  const preferredMode = raw?.preferredMode === "budget" ? "budget" : "cashflow";

  return {
    name: String(raw?.name || "").trim(),
    bankResource: String(raw?.bankResource || "").trim(),
    baselineBudget: baseline > 0 ? baseline : DEFAULT_PROFILE.baselineBudget,
    preferredMode,
    monthlySavingsGoal: savings >= 0 ? savings : 0,
  };
}

function loadProfileFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return normalizeProfile(parsed);
  } catch (_) {
    return { ...DEFAULT_PROFILE };
  }
}


function persistProfile(profile) {
  try {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile || DEFAULT_PROFILE));
  } catch (_) {
    // Ignore storage failures.
  }
}

function setProfileStatus(msg) {
  const el = document.getElementById("profile-status");
  if (!el) return;
  el.textContent = msg;
}

function profileFirstName() {
  const full = String(state.profile?.name || "").trim();
  if (!full) return "Fname";
  const first = full.split(/\s+/).filter(Boolean)[0] || "Fname";
  return first;
}

function possessiveName(name) {
  const n = String(name || "").trim();
  if (!n) return "Fname's";
  return /s$/i.test(n) ? `${n}'` : `${n}'s`;
}

function updateBrandingFromProfile() {
  const first = profileFirstName();
  const brand = `${possessiveName(first)} Personal Budget`;
  const brandEl = document.querySelector(".brand-text");
  if (brandEl) {
    brandEl.textContent = brand;
  }
  document.title = `${brand} Dashboard`;
}

function applyProfileToUi() {
  const p = state.profile || DEFAULT_PROFILE;

  const nameEl = document.getElementById("profile-name-input");
  const bankEl = document.getElementById("profile-bank-resource-input");
  const baselineEl = document.getElementById("profile-baseline-input");
  const modeEl = document.getElementById("profile-mode-input");
  const savingsEl = document.getElementById("profile-savings-goal-input");

  if (nameEl) nameEl.value = p.name;
  if (bankEl) bankEl.value = p.bankResource;
  if (baselineEl) baselineEl.value = Number(p.baselineBudget).toFixed(2);
  if (modeEl) modeEl.value = p.preferredMode;
  if (savingsEl) savingsEl.value = Number(p.monthlySavingsGoal).toFixed(2);
}

function applyProfileDefaultsToPipelineInputs(options = {}) {
  const p = state.profile || DEFAULT_PROFILE;
  const applyMode = Boolean(options.applyMode);

  const baselineEl = document.getElementById("baseline-input");
  if (baselineEl) {
    baselineEl.value = Number(p.baselineBudget).toFixed(2);
  }

  const calcModeEl = document.getElementById("calc-mode-input");
  if (calcModeEl) {
    calcModeEl.value = p.preferredMode;
    updateCalcModeTooltip();
    if (applyMode) {
      calcModeEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

function readProfileFromUi() {
  const name = document.getElementById("profile-name-input")?.value || "";
  const bankResource = document.getElementById("profile-bank-resource-input")?.value || "";
  const baselineBudget = toNum(document.getElementById("profile-baseline-input")?.value || "");
  const preferredModeRaw = document.getElementById("profile-mode-input")?.value || "cashflow";
  const monthlySavingsGoal = toNum(document.getElementById("profile-savings-goal-input")?.value || "");

  return normalizeProfile({
    name,
    bankResource,
    baselineBudget,
    preferredMode: preferredModeRaw,
    monthlySavingsGoal,
  });
}

function saveProfile() {
  const profile = readProfileFromUi();
  state.profile = profile;
  persistProfile(profile);
  updateBrandingFromProfile();
  applyProfileToUi();
  applyProfileDefaultsToPipelineInputs({ applyMode: true });
  setProfileStatus("Profile saved. Defaults are now applied to Import Pipeline inputs.");
}

function resetProfile() {
  state.profile = { ...DEFAULT_PROFILE };
  persistProfile(state.profile);
  updateBrandingFromProfile();
  applyProfileToUi();
  applyProfileDefaultsToPipelineInputs({ applyMode: true });
  setProfileStatus("Profile reset to defaults.");
}

function updatePipelineKnownExpensesDefinition(modeOverride) {
  const modeInput = document.getElementById("calc-mode-input");
  const mode = modeOverride || (modeInput?.value || state.meta.calcMode || "cashflow");
  const normalizedMode = mode === "budget" ? "budget" : "cashflow";

  const header = document.getElementById("known-expenses-header");
  const summary = document.getElementById("pipeline-mode-summary");

  if (header) {
    header.textContent = normalizedMode === "budget"
      ? "Known Expenses (Budget)"
      : "Known Expenses (Cashflow)";
  }

  if (summary) {
    summary.textContent = normalizedMode === "budget"
      ? "Known Expenses currently follows budget mode: card purchases + bank expenses excluding card-payment transfers."
      : "Known Expenses currently follows cashflow mode: all bank debits (including card payments).";
  }
}

function normalizeRoute(routeValue) {
  if (!routeValue) return "dashboard";
  const route = String(routeValue).replace(/^#/, "").trim().toLowerCase();
  return ROUTES.includes(route) ? route : "dashboard";
}

function applyRoute(route) {
  const normalized = normalizeRoute(route);
  state.route = normalized;

  document.querySelectorAll(".menu-link[data-route]").forEach((link) => {
    const linkRoute = normalizeRoute(link.getAttribute("data-route"));
    link.classList.toggle("active", linkRoute === normalized);
  });

  document.querySelectorAll("[data-route]").forEach((el) => {
    if (el.classList.contains("menu-link")) return;
    const panelRoute = normalizeRoute(el.getAttribute("data-route"));
    el.classList.toggle("panel-hidden", panelRoute !== normalized);
  });

  document.getElementById("menu-links").classList.remove("open");
}

function routeFromHash() {
  return normalizeRoute(window.location.hash);
}

function updateTopMeta() {
  const monthsEl = document.getElementById("months-loaded");
  if (monthsEl) {
    monthsEl.textContent = `Months loaded: ${state.rows.length}`;
  }

  const runEl = document.getElementById("last-run");
  if (!runEl) return;

  const when = formatImportedAt(state.meta.importedAt);
  if (state.meta.source === "pipeline-import") {
    runEl.textContent = when ? `Last pipeline run: ${when}` : "Last pipeline run: --";
    return;
  }

  const label = sourceLabel(state.meta.source);
  runEl.textContent = when ? `Last data update (${label}): ${when}` : "Last data update: --";
}

function yearFromMonth(month) {
  const s = String(month || "");
  return s.length >= 4 ? s.slice(0, 4) : "";
}

function monthIndexFromMonth(month) {
  const s = String(month || "");
  const m = Number(s.slice(5, 7));
  if (!Number.isFinite(m) || m < 1 || m > 12) return 0;
  return m;
}

function getAvailableYears() {
  return Array.from(new Set(state.rows.map((r) => yearFromMonth(r.month)).filter(Boolean))).sort();
}

function rowsForYear(year) {
  return state.rows
    .filter((r) => yearFromMonth(r.month) === year)
    .slice()
    .sort((a, b) => String(a.month || "").localeCompare(String(b.month || "")));
}

function latestMonthForYear(year) {
  const rows = rowsForYear(year);
  if (!rows.length) return "";
  return String(rows[rows.length - 1].month || "");
}

function renderYearSelector() {
  const sel = document.getElementById("year-select");
  if (!sel) return;

  const years = getAvailableYears();
  sel.innerHTML = "";

  years.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  });

  if (!years.length) {
    state.selectedYear = "";
    return;
  }

  if (!state.selectedYear || !years.includes(state.selectedYear)) {
    state.selectedYear = years[years.length - 1];
  }
  sel.value = state.selectedYear;

  sel.onchange = () => {
    state.selectedYear = sel.value;
    const targetMonth = latestMonthForYear(state.selectedYear);
    if (targetMonth) {
      const monthSel = document.getElementById("month-select");
      if (monthSel) monthSel.value = targetMonth;
      renderKpis(targetMonth);
      return;
    }
    renderDashboardTrendlines();
    renderSpikeNarrative();
  };
}

function renderMonthSelector() {
  const sel = document.getElementById("month-select");
  sel.innerHTML = "";

  const rowsDesc = state.rows.slice().sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));

  rowsDesc.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.month;
    opt.textContent = r.month;
    sel.appendChild(opt);
  });

  sel.onchange = () => {
    renderKpis(sel.value);
  };

  if (state.rows.length) {
    let targetMonth = state.selectedMonth && state.rows.some((r) => String(r.month) === state.selectedMonth)
      ? state.selectedMonth
      : "";
    if (!targetMonth && state.selectedYear) {
      targetMonth = latestMonthForYear(state.selectedYear);
    }
    if (!targetMonth) {
      targetMonth = String(state.rows[state.rows.length - 1].month || "");
    }
    sel.value = targetMonth;
    renderKpis(targetMonth);
  }
}

function renderKpis(month) {
  const row = state.rows.find((r) => r.month === month);
  if (!row) return;

  const income = toNum(row.incomeTotalForMonth || row.incomeObserved);
  const known = toNum(row.knownExpensesTotal);
  const net = toNum(row.netObservedMinusKnownExpenses);
  const cardFromRow = toNum(row.cardPurchasesObserved);
  const cardFallback = toNum(state.bankCardInfoByMonth[month]);
  const card = cardFromRow > 0 ? cardFromRow : cardFallback;
  const bank = toNum(row.bankExpensesObserved);
  const baseline = toNum(row.baselineExpenses);
  state.selectedMonth = month;
  const inferredYear = yearFromMonth(month);
  if (inferredYear) {
    state.selectedYear = inferredYear;
    const yearSel = document.getElementById("year-select");
    if (yearSel && yearSel.value !== inferredYear) {
      yearSel.value = inferredYear;
    }
  }

  document.getElementById("kpi-income").textContent = money.format(income);
  document.getElementById("kpi-expense").textContent = money.format(known);
  document.getElementById("kpi-net").textContent = money.format(net);
  document.getElementById("kpi-card").textContent = money.format(card);
  document.getElementById("kpi-bank").textContent = money.format(bank);
  document.getElementById("kpi-base").textContent = money.format(baseline);

  const netEl = document.getElementById("kpi-net");
  netEl.classList.remove("kpi-net-positive", "kpi-net-negative");
  netEl.classList.add(net >= 0 ? "kpi-net-positive" : "kpi-net-negative");

  renderModeDifferenceCallout(month);

  renderFlaggedTransactions(month);
  renderCategoryChart(month);
  renderDashboardTrendlines();
  renderSpikeNarrative();
}

function renderFlaggedTransactions(month) {
  const container = document.getElementById("flagged-transactions");
  if (!container) return;

  const outliers = state.outliersByMonth[month] || [];
  if (!outliers.length) {
    container.innerHTML = '<div class="flagged-empty">No flagged transactions for this month.</div>';
    return;
  }

  const html = `
    <div class="flagged-header">
      <div class="flagged-count">${outliers.length} flagged transaction${outliers.length === 1 ? "" : "s"}</div>
    </div>
    <div class="flagged-list">
      ${outliers.map((o) => `
        <div class="flagged-row">
          <div class="flagged-reason">${o.reason}</div>
          <div class="flagged-amount ${o.isIncome ? "income" : "expense"}">${o.isIncome ? "+" : "−"}${money.format(o.amount)}</div>
          <div class="flagged-desc">${o.description}</div>
        </div>
      `).join("")}
    </div>
  `;
  container.innerHTML = html;
}

function renderCategoryChart(month) {
  const container = document.getElementById("category-chart");
  if (!container) return;

  const actualMap = mergeForChart(state.categoryActualByMonth[month] || {});
  const budgetMap = mergeForChart(state.budgetByCategory || {});
  const categories = Array.from(new Set([...Object.keys(actualMap), ...Object.keys(budgetMap)]));

  if (!categories.length) {
    container.innerHTML = '<div class="cat-empty">No category data available for this month yet.</div>';
    return;
  }

  categories.sort((a, b) => {
    const av = Math.max(toNum(actualMap[a]), toNum(budgetMap[a]));
    const bv = Math.max(toNum(actualMap[b]), toNum(budgetMap[b]));
    return bv - av;
  });

  const maxVal = Math.max(1, ...categories.map((c) => Math.max(toNum(actualMap[c]), toNum(budgetMap[c]))));

  container.innerHTML = categories.map((c) => {
    const actual = toNum(actualMap[c]);
    const budget = toNum(budgetMap[c]);
    const aPct = Math.max(0, Math.round((actual / maxVal) * 100));
    const bPct = Math.max(0, Math.round((budget / maxVal) * 100));
    return `
      <div class="cat-row">
        <div class="cat-name">${categoryDisplayName(c)}</div>
        <div class="cat-bars">
          <div class="cat-track"><div class="cat-bar budget" style="width:${bPct}%"></div></div>
          <div class="cat-track"><div class="cat-bar actual" style="width:${aPct}%"></div></div>
        </div>
        <div class="cat-values">Budget ${money.format(budget)} | Actual ${money.format(actual)}</div>
      </div>
    `;
  }).join("");
}

function renderTrend() {
  const container = document.getElementById("trend-list");
  container.innerHTML = "";

  const rowsDesc = state.rows.slice().sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));

  const maxAbs = Math.max(
    1,
    ...state.rows.map((r) => Math.abs(toNum(r.netObservedMinusKnownExpenses)))
  );

  rowsDesc.forEach((r) => {
    const net = toNum(r.netObservedMinusKnownExpenses);
    const widthPct = Math.max(2, Math.round((Math.abs(net) / maxAbs) * 100));

    const row = document.createElement("div");
    row.className = "trend-row";
    row.innerHTML = `
      <div class="trend-month">${r.month}</div>
      <div class="trend-bar-track">
        <div class="trend-bar ${net >= 0 ? "pos" : "neg"}" style="width:${widthPct}%"></div>
      </div>
      <div class="trend-net">${money.format(net)}</div>
    `;

    container.appendChild(row);
  });
}

function pointsToPolyline(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function computeAnnualTracking(year) {
  const yearRows = rowsForYear(year);
  if (!yearRows.length) return null;

  const monthlyBudget = toNum(yearRows[yearRows.length - 1].baselineExpenses || yearRows[0].baselineExpenses);
  const annualBudget = monthlyBudget * 12;

  const actualByMonth = {};
  yearRows.forEach((r) => {
    const mi = monthIndexFromMonth(r.month);
    if (!mi) return;

    const hasBankField = Object.prototype.hasOwnProperty.call(r, "bankExpensesObserved");
    const hasCardField = Object.prototype.hasOwnProperty.call(r, "cardPurchasesObserved");
    const bank = toNum(r.bankExpensesObserved);
    const card = toNum(r.cardPurchasesObserved);
    const known = toNum(r.knownExpensesTotal);

    // If row is cashflow-like (known ~= bank), use bank only; otherwise use bank+card.
    const isCashflowLike = Math.abs(known - bank) < 0.01;
    const observed = isCashflowLike ? bank : (bank + card);

    // Prefer observed spending to avoid baseline double-counting.
    actualByMonth[mi] = (hasBankField || hasCardField)
      ? observed
      : known;
  });

  let actualYtd = 0;
  let latestMonth = 0;
  for (let m = 1; m <= 12; m += 1) {
    if (Object.prototype.hasOwnProperty.call(actualByMonth, m)) {
      actualYtd += toNum(actualByMonth[m]);
      latestMonth = m;
    }
  }

  const budgetYtd = monthlyBudget * latestMonth;
  const varianceYtd = actualYtd - budgetYtd;
  const remainingBudget = annualBudget - actualYtd;
  const remainingMonths = Math.max(0, 12 - latestMonth);
  const targetMonthlyForRemaining = remainingMonths > 0 ? remainingBudget / remainingMonths : 0;
  const neededReductionPerMonth = Math.max(0, monthlyBudget - Math.max(0, targetMonthlyForRemaining));

  const cumulativeBudget = [];
  const cumulativeActual = [];
  let runBudget = 0;
  let runActual = 0;
  for (let m = 1; m <= 12; m += 1) {
    runBudget += monthlyBudget;
    cumulativeBudget.push(runBudget);
    if (m <= latestMonth) {
      runActual += toNum(actualByMonth[m]);
      cumulativeActual.push(runActual);
    } else {
      cumulativeActual.push(null);
    }
  }

  return {
    year,
    yearRows,
    monthlyBudget,
    annualBudget,
    latestMonth,
    actualYtd,
    budgetYtd,
    varianceYtd,
    remainingBudget,
    remainingMonths,
    targetMonthlyForRemaining,
    neededReductionPerMonth,
    cumulativeBudget,
    cumulativeActual,
  };
}

function resetAnnualSummary() {
  ["annual-budget", "annual-actual-ytd", "annual-remaining", "annual-reduction"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "--";
  });
}

function renderAnnualSummary(annual) {
  const annualBudgetEl = document.getElementById("annual-budget");
  const annualActualEl = document.getElementById("annual-actual-ytd");
  const annualRemainingEl = document.getElementById("annual-remaining");
  const annualReductionEl = document.getElementById("annual-reduction");
  if (!annualBudgetEl || !annualActualEl || !annualRemainingEl || !annualReductionEl) return;

  annualBudgetEl.textContent = money.format(annual.annualBudget);
  annualActualEl.textContent = money.format(annual.actualYtd);
  annualRemainingEl.textContent = money.format(annual.remainingBudget);

  if (annual.remainingMonths <= 0) {
    annualReductionEl.textContent = "Year complete";
  } else if (annual.remainingBudget <= 0) {
    annualReductionEl.textContent = "Already over annual";
  } else {
    annualReductionEl.textContent = `${money.format(annual.neededReductionPerMonth)}/mo`;
  }
}

function renderDashboardTrendlines() {
  const container = document.getElementById("dashboard-trendlines");
  if (!container) return;

  const annual = computeAnnualTracking(state.selectedYear);
  if (!annual) {
    resetAnnualSummary();
    container.innerHTML = '<div class="line-empty">No annual data available for the selected year.</div>';
    return;
  }
  renderAnnualSummary(annual);

  const width = 980;
  const height = 280;
  const pad = { top: 16, right: 14, bottom: 34, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const months = MONTH_NAMES_SHORT;
  const budgetSeries = annual.cumulativeBudget;
  const expenseSeries = annual.cumulativeActual;
  const maxY = Math.max(
    1,
    ...budgetSeries,
    ...expenseSeries.filter((v) => v !== null).map((v) => toNum(v))
  );

  const xFor = (idx) => {
    if (months.length === 1) return pad.left + innerW / 2;
    return pad.left + (idx / (months.length - 1)) * innerW;
  };
  const yFor = (value) => pad.top + innerH - (value / maxY) * innerH;

  const budgetPts = budgetSeries.map((v, i) => ({ x: xFor(i), y: yFor(v), value: v, label: `${months[i]} ${annual.year}` }));
  const expensePts = expenseSeries
    .map((v, i) => (v === null ? null : ({ x: xFor(i), y: yFor(v), value: v, label: `${months[i]} ${annual.year}` })))
    .filter(Boolean);

  const yTicks = 4;
  const yTickEls = [];
  for (let i = 0; i <= yTicks; i += 1) {
    const t = i / yTicks;
    const y = pad.top + innerH - t * innerH;
    const val = t * maxY;
    yTickEls.push(`<line class="line-grid" x1="${pad.left}" y1="${y}" x2="${pad.left + innerW}" y2="${y}" />`);
    yTickEls.push(`<text class="line-y-label" x="${pad.left - 6}" y="${y + 3}" text-anchor="end">${Math.round(val).toLocaleString()}</text>`);
  }

  const xLabelStep = 2;
  const xTickEls = months.map((m, i) => {
    if (i % xLabelStep !== 0 && i !== months.length - 1) return "";
    const x = xFor(i);
    return `<text class="line-x-label" x="${x}" y="${height - 10}" text-anchor="middle">${m}</text>`;
  }).join("");

  const budgetDots = budgetPts.map((p) => `<circle class="line-dot-budget" cx="${p.x}" cy="${p.y}" r="2.4"><title>${p.label} Budget-to-date ${money.format(p.value)}</title></circle>`).join("");
  const expenseDots = expensePts.map((p) => `<circle class="line-dot-expense" cx="${p.x}" cy="${p.y}" r="2.4"><title>${p.label} Actual-to-date ${money.format(p.value)}</title></circle>`).join("");

  container.innerHTML = `
    <svg class="line-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${annual.year} cumulative budget versus cumulative actual expenses">
      ${yTickEls.join("")}
      <line class="line-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + innerH}" />
      <line class="line-axis" x1="${pad.left}" y1="${pad.top + innerH}" x2="${pad.left + innerW}" y2="${pad.top + innerH}" />
      <polyline class="line-path-budget" points="${pointsToPolyline(budgetPts)}" />
      <polyline class="line-path-expense" points="${pointsToPolyline(expensePts)}" />
      ${budgetDots}
      ${expenseDots}
      ${xTickEls}
    </svg>
  `;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function renderSpikeNarrative() {
  const container = document.getElementById("spike-narrative");
  if (!container) return;

  const annual = computeAnnualTracking(state.selectedYear);
  if (!annual) {
    container.innerHTML = '<div class="spike-callout">Load data to see annual tracking guidance.</div>';
    return;
  }

  const monthLabel = annual.latestMonth > 0
    ? `${MONTH_NAMES_SHORT[annual.latestMonth - 1]} ${annual.year}`
    : annual.year;
  const varianceDirection = annual.varianceYtd >= 0 ? "over" : "under";
  const varianceAbs = money.format(Math.abs(annual.varianceYtd));

  let actionText = "";
  if (annual.remainingMonths <= 0) {
    actionText = `Year is complete. Final variance is ${varianceAbs} ${varianceDirection} the YTD budget pace.`;
  } else if (annual.remainingBudget <= 0) {
    actionText = `You are already ${money.format(Math.abs(annual.remainingBudget))} over the full-year budget. Even zero spend for remaining months cannot fully recover this year.`;
  } else if (annual.targetMonthlyForRemaining >= annual.monthlyBudget) {
    const headroom = annual.targetMonthlyForRemaining - annual.monthlyBudget;
    actionText = `You are tracking under annual budget pace. Remaining months can average up to ${money.format(annual.targetMonthlyForRemaining)} (${money.format(headroom)} above your monthly baseline) and still finish within annual budget.`;
  } else {
    actionText = `To align to the annual budget, remaining months should average ${money.format(annual.targetMonthlyForRemaining)} each, which is a reduction of ${money.format(annual.neededReductionPerMonth)} per month from your current monthly budget baseline.`;
  }

  container.innerHTML = `
    <div class="spike-callout">Annual budget is ${money.format(annual.annualBudget)}. Through ${monthLabel}, observed spending is ${money.format(annual.actualYtd)} vs budget-to-date ${money.format(annual.budgetYtd)} (${varianceAbs} ${varianceDirection}).</div>
    <ul>
      <li><strong>Budget remaining:</strong> ${money.format(annual.remainingBudget)} across ${annual.remainingMonths} months.</li>
      <li><strong>Current monthly budget baseline:</strong> ${money.format(annual.monthlyBudget)}.</li>
    </ul>
    <div>${actionText}</div>
  `;
}

function renderTable() {
  const body = document.getElementById("snapshot-body");
  body.innerHTML = "";

  const rowsDesc = state.rows.slice().sort((a, b) => String(b.month || "").localeCompare(String(a.month || "")));

  rowsDesc.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.month}</td>
      <td class="right">${money.format(toNum(r.incomeTotalForMonth || r.incomeObserved))}</td>
      <td class="right">${money.format(toNum(r.knownExpensesTotal))}</td>
      <td class="right">${money.format(toNum(r.netObservedMinusKnownExpenses))}</td>
    `;
    body.appendChild(tr);
  });
}

function renderAll() {
  if (!state.rows.length) {
    setStatus("No rows parsed from CSV.");
    updatePipelineKnownExpensesDefinition();
    resetAnnualSummary();
    renderDashboardTrendlines();
    renderSpikeNarrative();
    return;
  }

  renderYearSelector();
  renderMonthSelector();
  renderTrend();
  renderTable();
  updateTopMeta();
  updatePipelineKnownExpensesDefinition(state.meta.calcMode);
  setStatus(`Results loaded: ${state.rows.length} months now visible in UI.`);
}

function downloadComputedSnapshotCsv() {
  if (!state.rows.length) {
    setStatus("No computed data available yet. Run imports or load snapshot first.");
    return;
  }

  const columns = [
    "month",
    "incomeObserved",
    "incomeBackfill",
    "incomeTotalForMonth",
    "baselineExpenses",
    "cardPurchasesObserved",
    "bankExpensesObserved",
    "knownExpensesTotal",
    "netObservedMinusKnownExpenses",
  ];

  const header = columns.join(",");
  const body = state.rows
    .map((row) => columns.map((col) => `"${String(row[col] ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `income-vs-expense-snapshot-computed-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadDefaultCsv(options = {}) {
  // No snapshot available - only pipeline imports supported
  // Try to restore last pipeline import from localStorage
  if (tryRestoreComputedState() && state.meta.source === "pipeline-import") {
    const calcModeEl = document.getElementById("calc-mode-input");
    const preferredMode = (state.meta.calcMode === "budget" || state.meta.calcMode === "cashflow")
      ? state.meta.calcMode
      : "cashflow";
    if (calcModeEl) calcModeEl.value = preferredMode;

    const applied = applySavedModeRows(preferredMode);
    if (!applied) {
      state.rows = normalizeRowsForMode(state.rows, preferredMode);
      renderAll();
    }

    const when = formatImportedAt(state.meta.importedAt);
    setStatus(when
      ? `Loaded last pipeline import from ${when}.`
      : "Loaded last pipeline import from browser storage.");
    return true;
  }

  // No saved data and no snapshot available
  setStatus("No data loaded. Use Import Pipeline to upload statements.");
  return false;
}

async function parseInputFile(inputId) {
  const el = document.getElementById(inputId);
  const file = el.files && el.files[0];
  if (!file) {
    throw new Error(`Missing file for ${inputId}`);
  }
  const text = await file.text();
  return parseCsv(text);
}

async function runRawImports() {
  try {
    // Ensure vendor mapping is loaded before processing
    if (Object.keys(state.vendorMapping).length === 0) {
      console.log("[IMPORT] Vendor mapping empty, loading now...");
      await loadVendorMapping();
    }

    // Ensure budget categories are loaded
    if (Object.keys(state.budgetCategories).length === 0) {
      console.log("[IMPORT] Budget categories empty, loading now...");
      await loadBudgetCategories();
    }
    
    const required = ["bank-csv-input", "card1-csv-input", "card2-csv-input"];
    const missing = required.filter((id) => {
      const el = document.getElementById(id);
      return !(el && el.files && el.files.length > 0);
    });

    if (missing.length > 0) {
      if (hasSavedPipelineImport() && tryRestoreComputedState() && state.meta.source === "pipeline-import") {
        const calcMode = document.getElementById("calc-mode-input").value || "cashflow";
        const applied = applySavedModeRows(calcMode);
        if (!applied) {
          renderAll();
        }
        updatePipelineKnownExpensesDefinition(calcMode);
        applyRoute("dashboard");
        window.location.hash = "dashboard";
        const when = formatImportedAt(state.meta.importedAt);
        setStatus(when
          ? `Reused last pipeline import (${calcMode} mode) from ${when}. Upload new files only when you want fresh month-end data.`
          : `Reused last pipeline import (${calcMode} mode). Upload new files only when you want a data refresh.`);
        return;
      }

      setStatus(`Import needs all 3 files. Missing ${missing.length} file(s).`);
      return;
    }

    const bankRows = await parseInputFile("bank-csv-input");
    const cardRows1 = await parseInputFile("card1-csv-input");
    const cardRows2 = await parseInputFile("card2-csv-input");

    const baselineRaw = document.getElementById("baseline-input").value;
    const baseline = toNum(baselineRaw || "8812.24");
    const calcMode = document.getElementById("calc-mode-input").value || "cashflow";

    const builtCashflow = buildSnapshotFromRawUploads(bankRows, cardRows1, cardRows2, baseline, "cashflow");
    const builtBudget = buildSnapshotFromRawUploads(bankRows, cardRows1, cardRows2, baseline, "budget");
    const built = calcMode === "budget" ? builtBudget : builtCashflow;
    if (!built.length) {
      setStatus("Could not derive monthly rows from uploads. Check CSV formats.");
      return;
    }

    state.rows = built;
    // categoryActualByMonth is already set by buildSnapshotFromRawUploads - don't overwrite it
    persistModeRows(builtCashflow, builtBudget);
    persistComputedState({ source: "pipeline-import", importedAt: new Date().toISOString(), calcMode });
    renderAll();
    updatePipelineKnownExpensesDefinition(calcMode);
    applyRoute("dashboard");
    window.location.hash = "dashboard";
    if (calcMode === "cashflow") {
      setStatus(`UI updated (${built.length} months): cashflow mode uses bank credits as income and all bank debits (including card payments) as expenses; card spend is shown as informational only.`);
    } else {
      setStatus(`UI updated (${built.length} months): budget mode uses observed spend (card purchases + bank expenses excluding card-payment transfers) and compares it against baseline budget.`);
    }
  } catch (err) {
    setStatus(`Import failed: ${err.message}`);
  }
}

function clearImports() {
  ["bank-csv-input", "card1-csv-input", "card2-csv-input"].forEach((id) => {
    const el = document.getElementById(id);
    el.value = "";
  });
  updateRunImportsState();
  setStatus("Upload inputs cleared. You can still reuse last pipeline import, or select new files for a refresh.");
}

function updateCalcModeTooltip() {
  const calc = document.getElementById("calc-mode-input");
  if (!calc) return;
  const mode = calc.value || "cashflow";
  if (mode === "budget") {
    calc.title = "Use Budget mode for planning. Known expenses use observed spend (card purchases + bank expenses excluding card-payment transfers), compared against baseline budget.";
  } else {
    calc.title = "Use Cashflow mode to validate against bank balance movement. Known expenses use bank debits (including card payments).";
  }
}

function hasSavedPipelineImport() {
  try {
    const rawMeta = localStorage.getItem(STORAGE_META_KEY);
    const rawRows = localStorage.getItem(STORAGE_ROWS_KEY);
    if (!rawMeta || !rawRows) return false;

    const meta = JSON.parse(rawMeta);
    const rows = JSON.parse(rawRows);
    return meta && meta.source === "pipeline-import" && Array.isArray(rows) && rows.length > 0;
  } catch (_) {
    return false;
  }
}

function updateRunImportsState() {
  const runBtn = document.getElementById("run-imports");
  if (!runBtn) return;

  const required = ["bank-csv-input", "card1-csv-input", "card2-csv-input"];
  const missing = required.filter((id) => {
    const el = document.getElementById(id);
    return !(el && el.files && el.files.length > 0);
  });

  const ready = missing.length === 0;
  const canReuse = hasSavedPipelineImport();
  runBtn.disabled = !(ready || canReuse);
  if (ready) {
    runBtn.title = "Recompute dashboard results from uploaded raw files using the selected calculation mode.";
  } else if (canReuse) {
    runBtn.title = "No new files selected. This will reuse your last saved pipeline import.";
  } else {
    runBtn.title = "Select all 3 CSV files first (bank + 2 card files).";
  }
}

function bindUi() {
  state.profile = loadProfileFromStorage();
  updateBrandingFromProfile();
  applyProfileToUi();

  // Initialize default budget categories for chart rendering
  if (window.BUDGET_APP_DEFAULT_BUDGET_BY_CATEGORY) {
    state.budgetByCategory = { ...window.BUDGET_APP_DEFAULT_BUDGET_BY_CATEGORY };
  }

  // Pipeline-only workflow - no snapshot buttons

  document.getElementById("run-imports").addEventListener("click", runRawImports);
  document.getElementById("download-computed").addEventListener("click", downloadComputedSnapshotCsv);
  document.getElementById("clear-imports").addEventListener("click", clearImports);

  const saveProfileBtn = document.getElementById("save-profile");
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", saveProfile);
  }

  const resetProfileBtn = document.getElementById("reset-profile");
  if (resetProfileBtn) {
    resetProfileBtn.addEventListener("click", resetProfile);
  }

  ["bank-csv-input", "card1-csv-input", "card2-csv-input"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      updateRunImportsState();
      const required = ["bank-csv-input", "card1-csv-input", "card2-csv-input"];
      const missingCount = required.filter((rid) => {
        const rel = document.getElementById(rid);
        return !(rel && rel.files && rel.files.length > 0);
      }).length;
      if (missingCount > 0) {
        if (hasSavedPipelineImport()) {
          setStatus(`Select ${missingCount} more file(s) for a fresh run, or click Show Results in UI to reuse last import.`);
        } else {
          setStatus(`Select ${missingCount} more file(s), then click Show Results in UI.`);
        }
      }
    });
  });

  const calcModeEl = document.getElementById("calc-mode-input");
  if (calcModeEl) {
    calcModeEl.addEventListener("change", () => {
      updateCalcModeTooltip();
      updatePipelineKnownExpensesDefinition(calcModeEl.value || "cashflow");
      if (!hasSavedPipelineImport()) return;

      const required = ["bank-csv-input", "card1-csv-input", "card2-csv-input"];
      const hasAnyFile = required.some((id) => {
        const el = document.getElementById(id);
        return !!(el && el.files && el.files.length > 0);
      });
      if (hasAnyFile) return;

      const mode = calcModeEl.value || "cashflow";
      const applied = applySavedModeRows(mode);
      if (applied) {
        const when = formatImportedAt(state.meta.importedAt);
        setStatus(when
          ? `Switched view to ${mode} mode using saved pipeline import from ${when}.`
          : `Switched view to ${mode} mode using saved pipeline import.`);
      } else {
        setStatus("Mode cache not available yet for this saved import. Run one fresh import with files to enable instant mode switching.");
      }
    });
    updateCalcModeTooltip();
  }

  applyProfileDefaultsToPipelineInputs();

  updatePipelineKnownExpensesDefinition();

  updateRunImportsState();

  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("menu-links").classList.toggle("open");
  });

  document.querySelectorAll(".menu-link[data-route]").forEach((link) => {
    link.addEventListener("click", (evt) => {
      evt.preventDefault();
      const targetRoute = normalizeRoute(link.getAttribute("data-route"));
      window.location.hash = targetRoute;
      applyRoute(targetRoute);
    });
  });

  window.addEventListener("hashchange", () => {
    applyRoute(routeFromHash());
  });

  applyRoute(routeFromHash());

  // Load vendor mapping and budget categories, then attempt to restore from localStorage
  (async () => {
    try {
      // Load vendor mapping first (needed by restoration logic)
      if (Object.keys(state.vendorMapping).length === 0) {
        console.log("[INIT] Loading vendor mapping...");
        await loadVendorMapping();
      }
      
      // Load budget categories
      if (Object.keys(state.budgetCategories).length === 0) {
        console.log("[INIT] Loading budget categories...");
        await loadBudgetCategories();
      }

      // Attempt to restore pipeline import from localStorage
      if (tryRestoreComputedState() && state.meta.source === "pipeline-import") {
        const calcMode = state.meta.calcMode || "cashflow";
        const calcModeEl = document.getElementById("calc-mode-input");
        if (calcModeEl) calcModeEl.value = calcMode;

        const applied = applySavedModeRows(calcMode);
        if (!applied) {
          state.rows = normalizeRowsForMode(state.rows, calcMode);
          renderAll();
        }

        const when = formatImportedAt(state.meta.importedAt);
        setStatus(when
          ? `Restored last pipeline import (${calcMode} mode) from ${when}.`
          : `Restored last pipeline import (${calcMode} mode).`);
      } else {
        console.log("[INIT] No saved pipeline import found");
        setStatus("No data loaded. Use Import Pipeline to upload statements.");
      }
    } catch (e) {
      console.warn("[INIT] Initialization failed:", e);
      setStatus("No data loaded. Use Import Pipeline to upload statements.");
    }
  })();
}

bindUi();
