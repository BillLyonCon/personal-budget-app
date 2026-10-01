# PHASE 5 RUNTIME BUG ANALYSIS

## ISSUE SUMMARY

**Symptoms:**
- Monthly Budget displays: $0.00 (expected: $28,613.91)
- Annual Budget displays: $0.00 (expected: $343,366.92)
- Phase 5 labels ARE visible (HTML loaded correctly)
- Application opened via file:// protocol (file:///C:/dev/personal-budget-app/app/index.html#dashboard)

**Root Cause Identified:** ✅ FOUND

---

## ROOT CAUSE ANALYSIS

### 1. The Phase 5 Code Change

In Phase 5, we changed renderKpis() to use Budget.csv:
```javascript
// Line 1424 (NEW)
const baseline = toNum(state.budgetConfigValidation?.sumAllBudgets || 0);
```

**Problem:** This requires `state.budgetConfigValidation.sumAllBudgets` to be populated at runtime.

---

### 2. When/How Should Budget.csv Be Loaded?

**Function that loads Budget.csv:**
- `loadBudgetConfig()` - defined at line 738
- Reads "../data/config/Budget.csv"
- Parses and validates
- Populates `state.budgetConfigValidation.sumAllBudgets` = 28613.91

**Function that SHOULD call it:**
- `loadAndValidateConfiguration()` - defined at line 805
- Calls both loadBudgetConfig() and loadBankRules()
- But this function is NEVER called during startup!

---

### 3. THE CRITICAL BUG: Missing Initialization Call

**Current Application Startup (app/script.js, lines ~2130-2160):**

```javascript
// This async IIFE runs when the page loads
(async () => {
  try {
    // Load vendor mapping
    if (Object.keys(state.vendorMapping).length === 0) {
      console.log("[INIT] Loading vendor mapping...");
      await loadVendorMapping();  // ✓ CALLED
    }
    
    // Load budget categories
    if (Object.keys(state.budgetCategories).length === 0) {
      console.log("[INIT] Loading budget categories...");
      await loadBudgetCategories();  // ✓ CALLED
    }

    // NOTE: loadBudgetConfig() is NOT called here  ✗ MISSING!
    // NOTE: loadBankRules() is NOT called here      ✗ MISSING!

    // Attempt to restore pipeline import from localStorage
    if (tryRestoreComputedState() && state.meta.source === "pipeline-import") {
      const calcMode = state.meta.calcMode || "cashflow";
      // ...
    }
  } catch (e) {
    // ...
  }
})();
```

**Result:**
- `state.budgetConfigValidation` is NEVER initialized
- `state.budgetConfigValidation.sumAllBudgets` remains undefined
- Phase 5 code: `toNum(state.budgetConfigValidation?.sumAllBudgets || 0)` returns 0 (the fallback)

---

### 4. Why Was This Not Caught During Testing?

**When loadBudgetConfig() IS successfully called:**
1. During Import Pipeline workflow - when user clicks "Show Results in UI"
   - Line 1902: `await loadVendorMapping();`
   - Line 1908: `await loadBudgetCategories();`
   - Line 1913: `await loadBankRules();`
   - But NOT `await loadBudgetConfig();` ✗

2. In test scripts (phase3-final-verify.js, phase4-test.js, etc.)
   - These scripts manually call loadBudgetConfig() before testing
   - Test scripts simulated the configuration being loaded

**Testing Gap:** Test scripts simulated Budget.csv loading, but the actual application startup doesn't load it!

---

### 5. File Path Verification ✅

**File locations (verified):**
- `app/index.html` → C:\dev\personal-budget-app\app\index.html
- `data/config/Budget.csv` → C:\dev\personal-budget-app\data\config\Budget.csv
- `data/config/Bank rules.csv` → C:\dev\personal-budget-app\data\config\Bank rules.csv

**Relative path from app/:** `../data/config/Budget.csv` ✓ CORRECT

---

### 6. File:// Protocol Compatibility ✅

**readTextFromUrl() function (line 84):**
```javascript
async function readTextFromUrl(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      return await res.text();
    }
  } catch (_) {
    // Fall back to XHR for file:// protocol
  }

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = () => {
      // file:// reports status 0 on success
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.responseText || "");
      }
    };
    xhr.onerror = () => reject(new Error("Network/XHR error"));
    xhr.send();
  });
}
```

**Analysis:**
- ✅ Has fetch() with fallback to XHR (good for file:// protocol)
- ✅ XHR accepts status 0 for file:// protocol (correct handling)
- ✅ Relative paths work with file:// protocol
- **Conclusion:** File loading WOULD WORK if it were called

---

### 7. Order of Execution (Timeline)

**When index.html is opened (file:// protocol):**

1. **Line 2200:** `bindUi();` is called
2. **Lines 2119-2160:** async IIFE starts
   - Loads vendorMapping
   - Loads budgetCategories
   - ❌ Does NOT load budgetConfig (BUG)
   - Tries to restore from localStorage
3. **Line 1424:** If user views dashboard, renderKpis() is called
   - Tries to read `state.budgetConfigValidation?.sumAllBudgets`
   - Returns 0 (because never loaded)
   - KPI displays $0.00

---

### 8. When Does loadBudgetConfig() Actually Get Called?

**Scenario 1: User Imports Files**
- User clicks "Show Results in UI" in Import Pipeline tab
- runRawImports() function runs (line 1873)
- Line 1902: `await loadVendorMapping();`
- Line 1908: `await loadBudgetCategories();`
- Line 1913: `await loadBankRules();`
- ❌ But still NO `await loadBudgetConfig();` call
- Creates snapshot with old baseline value (from pipeline input)
- KPI displays manual baseline ($8,812.24 was the input)

**Scenario 2: Manual Test Scripts**
- test scripts call loadBudgetConfig() explicitly
- This is why tests showed correct values
- But this doesn't represent actual application use

---

## ROOT CAUSE SUMMARY

**The Bug:**
```
loadBudgetConfig() is defined but NEVER called during application startup
↓
state.budgetConfigValidation is never populated
↓
Phase 5 code tries to read state.budgetConfigValidation.sumAllBudgets
↓
Returns undefined, falls back to 0
↓
Monthly Budget displays $0.00 instead of $28,613.91
```

**Why It Happened:**
- Phase 4 implementation added loadBudgetConfig() but forgot to call it during init
- Test scripts manually called it (masking the bug)
- Phase 5 changes revealed the bug by depending on the value

---

## SOLUTION

### Minimum Fix Required

Add loadBudgetConfig() call to the application startup initialization.

**Location:** app/script.js, around line 2140

**Current code (lines 2136-2160):**
```javascript
(async () => {
  try {
    if (Object.keys(state.vendorMapping).length === 0) {
      console.log("[INIT] Loading vendor mapping...");
      await loadVendorMapping();
    }
    
    if (Object.keys(state.budgetCategories).length === 0) {
      console.log("[INIT] Loading budget categories...");
      await loadBudgetCategories();
    }

    // ← ADD HERE: loadBudgetConfig()

    if (tryRestoreComputedState() && state.meta.source === "pipeline-import") {
      // ...
    }
  }
})();
```

**Proposed fix:**
```javascript
(async () => {
  try {
    // Load vendor mapping
    if (Object.keys(state.vendorMapping).length === 0) {
      console.log("[INIT] Loading vendor mapping...");
      await loadVendorMapping();
    }
    
    // Load budget categories
    if (Object.keys(state.budgetCategories).length === 0) {
      console.log("[INIT] Loading budget categories...");
      await loadBudgetCategories();
    }

    // Phase 5: Load Budget.csv configuration
    if (!state.budgetConfigValidation || !state.budgetConfigValidation.sumAllBudgets) {
      console.log("[INIT] Loading Budget.csv configuration...");
      await loadBudgetConfig();
    }

    // Phase 3: Load Bank rules (also missing!)
    if (!state.bankRulesRows || state.bankRulesRows.length === 0) {
      console.log("[INIT] Loading Bank rules...");
      await loadBankRules();
    }

    // Restore from localStorage
    if (tryRestoreComputedState() && state.meta.source === "pipeline-import") {
      // ...
    }
  }
})();
```

---

## VERIFICATION

### After Fix Applied

1. **On app startup:**
   - loadBudgetConfig() runs
   - Fetches ../data/config/Budget.csv (XHR fallback handles file://)
   - Parses and validates
   - Populates state.budgetConfigValidation.sumAllBudgets = 28613.91

2. **When renderKpis() is called:**
   - Line 1424: `const baseline = toNum(state.budgetConfigValidation?.sumAllBudgets || 0);`
   - Returns 28613.91 (not 0)
   - Monthly Budget KPI displays: **$28,613.91** ✓

3. **When computeAnnualTracking() is called:**
   - Line 1566: `const monthlyBudget = toNum(state.budgetConfigValidation?.sumAllBudgets || 0);`
   - Returns 28613.91
   - Annual Budget = 28613.91 × 12 = **$343,366.92** ✓

---

## IMPACT ASSESSMENT

**What will change:**
- ✅ Monthly Budget displays correct value ($28,613.91)
- ✅ Annual Budget displays correct value ($343,366.92)
- ✅ Bank rules will be loaded (also currently missing)
- ✅ No impact to calculation logic (only initialization)

**What will NOT change:**
- ✅ All calculations unchanged (same formulas)
- ✅ categoryActualByMonth unchanged
- ✅ knownExpensesTotal unchanged
- ✅ Transaction processing unchanged
- ✅ All protected systems protected
- ✅ No regression risk (adding missing code, not changing existing)

---

## FILE LOCATIONS (Verified)

```
C:\dev\personal-budget-app\
├── app\
│   └── index.html                          (opened as file:///C:/dev/personal-budget-app/app/index.html)
└── data\
    └── config\
        ├── Budget.csv                      (loaded via ../data/config/Budget.csv from app/)
        └── Bank rules.csv                  (loaded via ../data/config/Bank rules.csv from app/)
```

All relative paths are correct. The issue is purely that loadBudgetConfig() was never called.

---

## CONCLUSION

**Root Cause:** loadBudgetConfig() missing from application startup initialization  
**Impact:** Monthly Budget and Annual Budget display $0.00  
**Severity:** HIGH (breaks Phase 5 feature)  
**Fix Complexity:** MINIMAL (add 4 lines to initialization)  
**Regression Risk:** NONE (adding missing initialization code)  
**Browser Compatibility:** No additional workarounds needed (XHR fallback already in place)
