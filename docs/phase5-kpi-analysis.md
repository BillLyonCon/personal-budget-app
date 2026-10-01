# PHASE 5 ANALYSIS: Overall KPI Area Redesign

## EXECUTIVE SUMMARY

**Status:** ANALYSIS ONLY - NO CODE CHANGES

**Objective:** Analyze current KPI area implementation, identify what must change for Phase 5 Budget vs Actual integration, and propose minimum UI modifications while preserving useful information and distinct layers.

---

# SECTION 1: CURRENT KPI AREA AUDIT

## 1.1 DISPLAYED KPI CARDS

The KPI grid currently displays 6 cards in this order:

| # | Card ID | Visible Label | Help Tip |
|---|---------|---------------|-|
| 1 | kpi-income | Income Total | Total income for the selected month |
| 2 | kpi-expense | Known Expenses | Mode-aware expense total used in net math |
| 3 | kpi-net | Net Result | Income minus Known Expenses |
| 4 | kpi-card | Card Spend (Info) | Mode-dependent card context |
| 5 | kpi-bank | Bank Expenses | Bank debit expenses observed |
| 6 | kpi-base | Baseline Expenses | Monthly budget baseline used for planning |

---

## 1.2 EACH KPI CARD: SOURCE, FIELD, CALCULATION

### **Card #1: Income Total**
- **HTML Element:** `#kpi-income`
- **State Field:** `row.incomeTotalForMonth`
- **Calculation:** `row.incomeObserved + row.incomeBackfill` (from buildSnapshotFromRawUploads line 1096)
- **Monthly:** YES (per-row calculation)
- **Data Source:** Bank statements (income rows with amount > 0)
- **Useful in new architecture:** YES - Income is independent of budget mode and should remain
- **Notes:**
  - Set in renderKpis() line 1418
  - Fallback to row.incomeObserved if incomeTotalForMonth missing
  - Updated annually by incomeBackfill for year-to-date guidance

---

### **Card #2: Known Expenses**
- **HTML Element:** `#kpi-expense`
- **State Field:** `row.knownExpensesTotal`
- **Calculation:** Mode-dependent (lines 1098-1101):
  - **Cashflow mode:** `bankExpensesObserved`
  - **Budget mode:** `cardPurchasesObserved + bankExpensesObserved`
- **Monthly:** YES (per-row calculation)
- **Data Source:** Bank expenses + Card purchases (depending on mode)
- **Useful in new architecture:** UNCERTAIN - This is the "old overall expense" - replaced by categorized actuals in Phase 4/5
- **Notes:**
  - Mode-aware recalculation in normalizeRowsForMode() line 171-173
  - Used in net calculation: `income - knownExpensesTotal`
  - Will be replaced by sum of categorized actuals in Phase 5

---

### **Card #3: Net Result**
- **HTML Element:** `#kpi-net`
- **State Field:** `row.netObservedMinusKnownExpenses`
- **Calculation:** `incomeTotalForMonth - knownExpensesTotal` (line 1103)
- **Monthly:** YES (per-row calculation)
- **Data Source:** Derived from income + expenses
- **Useful in new architecture:** UNCERTAIN - Net changes if knownExpensesTotal changes to categorized actual
- **Notes:**
  - Colored: green if ≥0 (positive), red if <0 (negative)
  - Currently represents "cash left over" in cashflow or "budget vs observed" in budget mode
  - Should either stay if using knownExpensesTotal, or be replaced by Budget vs Actual for Month

---

### **Card #4: Card Spend (Info)**
- **HTML Element:** `#kpi-card`
- **State Field:** `row.cardPurchasesObserved`
- **Calculation:** Sum of credit card transactions for month (line 1049)
- **Monthly:** YES (per-row calculation)
- **Data Source:** Credit card CSV imports (Chase card feeds)
- **Useful in new architecture:** YES - Informational breakdown still useful (shows what was purchased vs paid)
- **Notes:**
  - Set in renderKpis() line 1418-1423
  - Has fallback to bankCardInfoByMonth[month] if cardPurchasesObserved = 0
  - Shows "what was charged" not "what was paid"
  - Complementary to Bank Expenses

---

### **Card #5: Bank Expenses**
- **HTML Element:** `#kpi-bank`
- **State Field:** `row.bankExpensesObserved`
- **Calculation:** Sum of bank debit transactions (line 1037)
- **Monthly:** YES (per-row calculation)
- **Data Source:** Bank CSV imports
- **Useful in new architecture:** YES - Informational breakdown still useful (shows actual bank outflows)
- **Notes:**
  - Set in renderKpis() line 1418-1423
  - Includes all bank debits: card payments + direct bank expenses
  - In cashflow mode, this IS knownExpensesTotal
  - In budget mode, subset of knownExpensesTotal (card payments excluded)

---

### **Card #6: Baseline Expenses** ⚠️ **CRITICAL ANALYSIS**
- **HTML Element:** `#kpi-base`
- **State Field:** `row.baselineExpenses`
- **Calculation:** `toNum(baseline)` where baseline parameter passed to buildSnapshotFromRawUploads (line 1095)
- **Monthly:** YES (constant value for all rows, but per-row field)
- **Data Source:** Profile.baselineBudget (user-entered default budget in UI)
- **Useful in new architecture:** **BEING REPLACED** - Should be replaced by sum from Budget.csv ($28,613.91)
- **Notes:**
  - Currently comes from Profile.baselineBudget (manual entry)
  - OLD: Used for annual budget tracking (line 1566: annualBudget = monthlyBudget * 12)
  - **NEW (Phase 4+):** Should come from state.budgetConfigValidation.sumAllBudgets ($28,613.91)
  - Stored in row.baselineExpenses for consistency with annual tracking
  - Used by renderAnnualSummary() for "Annual Budget" calculation
  - **DEPENDENCY:** Annual tracking must migrate to use Budget.csv sum instead

---

## 1.3 KPI GRID USAGE FLOW

```
User selects month from dropdown
  ↓
renderKpis(month) called
  ↓
Find row where row.month === month
  ↓
Extract 6 values:
  1. income = row.incomeTotalForMonth || row.incomeObserved
  2. known = row.knownExpensesTotal (mode-dependent)
  3. net = row.netObservedMinusKnownExpenses
  4. card = row.cardPurchasesObserved (with fallback)
  5. bank = row.bankExpensesObserved
  6. baseline = row.baselineExpenses
  ↓
Display all 6 in KPI cards
  ↓
Also trigger:
  - renderModeDifferenceCallout(month)
  - renderFlaggedTransactions(month)
  - renderCategoryChart(month)
  - renderDashboardTrendlines()
  - renderSpikeNarrative()
```

---

# SECTION 2: BASELINEEXPENSES DEPENDENCY AUDIT

## 2.1 WHERE BASELINEEXPENSES IS ASSIGNED

### **Location 1: buildSnapshotFromRawUploads() - Line 1095**
```javascript
r.baselineExpenses = Number(baseline.toFixed(2));
```
- **Context:** Every monthly row created gets assigned the same baseline value
- **Source:** `baseline` parameter (comes from user input via "baseline-input")
- **Scope:** Applied to ALL rows in given month
- **Phase 5 Impact:** MUST CHANGE to budgetConfigValidation.sumAllBudgets

---

### **Location 2: Default Profile**
```javascript
const DEFAULT_PROFILE = {
  baselineBudget: 8812.24,  // Line 56
  // ...
}
```
- **Context:** Fallback value if user hasn't entered custom budget
- **Phase 5 Impact:** May need update if Budget.csv total becomes standard

---

## 2.2 WHERE BASELINEEXPENSES IS READ

### **Location 1: renderKpis() - Line 1425**
```javascript
const baseline = toNum(row.baselineExpenses);
// ... then rendered to #kpi-base
```
- **Context:** Display "Baseline Expenses" KPI card
- **Purpose:** Show budget target for the month
- **Phase 5 Impact:** Will still display, but source changes

---

### **Location 2: computeAnnualTracking() - Line 1566**
```javascript
const monthlyBudget = toNum(yearRows[yearRows.length - 1].baselineExpenses || yearRows[0].baselineExpenses);
const annualBudget = monthlyBudget * 12;
```
- **Context:** Annual budget calculation (used for "Annual Budget" KPI and trend line)
- **Purpose:** Calculate annual target from monthly baseline × 12
- **Phase 5 Impact:** CRITICAL - This must change to use Budget.csv sum, not baselineExpenses row field
- **Risk:** If baselineExpenses is removed, annual tracking breaks
- **Solution:** Annual tracking should read from state.budgetConfigValidation.sumAllBudgets instead

---

### **Location 3: Application Profile Display - Line 1188, 1199**
```javascript
if (baselineEl) baselineEl.value = Number(p.baselineBudget).toFixed(2);
```
- **Context:** Show user's baseline budget in Profile UI
- **Purpose:** Display and edit user's manual budget entry
- **Phase 5 Impact:** Should show Budget.csv total instead (read-only, not editable)

---

## 2.3 WHERE BASELINEEXPENSES IS SAVED/LOADED

### **Save to localStorage**
Not explicitly stored (baselineExpenses is row field, rows are persisted via persistModeRows)

### **Load from localStorage**
Not explicitly loaded separately (baselineExpenses is rebuilt during buildSnapshotFromRawUploads on each import)

### **CSV Export - Line 1834**
```javascript
"baselineExpenses",  // Included in export headers
```
- **Context:** Month-level export includes baselineExpenses column
- **Phase 5 Impact:** Column will continue to exist if budget column is added to export

---

## 2.4 WHERE BASELINEEXPENSES IS USED IN CALCULATIONS

### **Net Result** (line 1103)
- Does NOT directly use baselineExpenses
- Uses knownExpensesTotal instead

### **Annual Tracking** (line 1566) ⚠️ **CRITICAL USE**
```javascript
const monthlyBudget = toNum(yearRows[yearRows.length - 1].baselineExpenses || yearRows[0].baselineExpenses);
```
- **Direct dependency:** Annual budget × 12 calculation
- **Current:** Uses baselineExpenses from row
- **Phase 5:** Should use Budget.csv sum from state
- **Risk Level:** HIGH - annual guidance breaks if not migrated

### **Mode-aware calculations**
- NO direct use in knownExpensesTotal calculation
- Used only for display + annual math

---

## 2.5 ASSESSMENT: IS BASELINEEXPENSES STILL NEEDED?

### **Before Phase 5:**
- **YES** - Stores manual user budget for comparison
- Used for: KPI display, annual tracking calculation

### **After Phase 5 (Budget.csv integration):**
- **PARTIALLY NEEDED:**
  - ✅ Can keep in row fields for historical compatibility
  - ✅ Display in KPI card (becomes Budget.csv sum instead of manual entry)
  - ❌ **MUST NOT** use for annual tracking - use Budget.csv sum instead
  - ⚠️ Profile UI should show read-only Budget.csv total, not editable manual budget

### **Recommended Action:**
1. **Keep baselineExpenses in row structure** for now (backward compatibility with existing data)
2. **Replace source:** buildSnapshotFromRawUploads should use state.budgetConfigValidation.sumAllBudgets
3. **Update annual tracking:** computeAnnualTracking should read from state instead of row field
4. **Update Profile UI:** Show read-only Budget.csv total instead of editable baselineBudget
5. **Future (Phase 6+):** Can deprecate baselineExpenses row field if not needed for analytics

---

# SECTION 3: INCOME INTEGRATION ANALYSIS

## 3.1 CURRENT INCOME IMPLEMENTATION

### **Where Income Comes From**
- **Source:** Bank CSV uploads (rows with Amount > 0)
- **Field Names:** `incomeObserved` (actual deposits from bank)
- **Backfill:** `incomeBackfill` (user-entered historical income for YTD calculations)

### **Where Income is Displayed**
1. **KPI Card #1:** `#kpi-income` shows `incomeTotalForMonth` (line 1436)
2. **Monthly Net Trend:** Table shows `incomeTotalForMonth` per month (line 1796)
3. **Annual Tracking:** Not directly displayed (only used for net calculation)

### **Income in KPI Grid Context**

**Current KPI Flow:**
```
Income Total ($X)
    ↓ (minus)
Known Expenses ($Y)
    ↓
= Net Result ($X - $Y)
```

**Paired with:**
- Card Spend (Info) - shows breakdown of expenses
- Bank Expenses - shows other expenses
- Baseline Expenses - shows budget target

### **Income Independence**
✅ **Income is mode-independent:**
- Does NOT change between Cashflow and Budget modes
- Always shows observed deposits + backfill
- Can coexist with Budget vs Actual comparisons

### **Can Income Remain Alongside Budget vs Actual?**

**YES - With minimal changes:**

**Current (Cashflow/Budget Mode):**
```
Income Total: $5,000
Known Expenses: $4,500  (Cashflow) or $4,200  (Budget)
Net Result: $500  (Cashflow) or $800  (Budget)
```

**Proposed (Phase 5, Budget Mode):**
```
Income Total: $5,000
Budget: $4,100
Actual (Categorized): $4,200
Budget vs Actual: -$100  (over by $100)
Net Result (Cashflow legacy): $500  (still Cashflow mode)
```

**Conflicts to Resolve:**
1. **"Known Expenses" becomes ambiguous** in Budget mode:
   - Old definition: cardPurchasesObserved + bankExpensesObserved
   - New context: Budget is from Budget.csv, Actual is from categorized totals
   - **Solution:** Keep "Known Expenses" as informational breakdown, add separate "Budget vs Actual" row

2. **"Net Result" becomes misleading** if using Budget vs Actual:
   - Old: Income - Known Expenses (comparing against observed spending)
   - New: Income - Actual (but Budget is separate)
   - **Solution:** Clarify or split into two net concepts

3. **Mode switching still matters** for "Known Expenses" calculation:
   - Cashflow mode: Known = bank debits only
   - Budget mode: Known = card purchases + bank expenses (excluding transfers)
   - **Solution:** Keep the mode-aware calculation for backward compatibility

---

## 3.2 PROPOSED INCOME POSITIONING

**Option 1: Keep Income as first card (minimal change)**
```
Income Total: $5,000
    ↓
Budget vs Actual Comparison (new): Budget $4,100 vs Actual $4,200
    ↓
Net (Income - Actual): $800
```
- Preserves income's role in net calculation
- Actual is categorized total (not knownExpensesTotal)
- Known Expenses stays as information card

**Option 2: Separate Income from Budget Comparison**
```
ROW 1: Income Total: $5,000
ROW 2: Budget vs Actual Comparison
ROW 3: Informational Breakdown (Card Spend, Bank Expenses, Known Expenses)
```
- Cleaner separation of concerns
- Income is always first (consistent with current design)
- Budget comparison is separate analysis

---

# SECTION 4: PHASE 5 OVERALL VALUES SPECIFICATION

## 4.1 MONTHLY OVERALL BUDGET

**Source:** sum of ALL rows in Budget.csv grouped by Category

**Verified Value:** $28,613.91

**How to Get:**
- Already calculated in state.budgetConfigValidation.sumAllBudgets (Phase 4)
- Load from state when rendering KPI: `state.budgetConfigValidation.sumAllBudgets`

**Consistency:** SAME every month (not seasonally adjusted)

---

## 4.2 MONTHLY OVERALL ACTUAL (EXISTING VERIFIED VALUE)

### **Critical Requirement:** Preserve Existing Budget-Mode Calculation

**Do NOT invent new calculation.** Use EXISTING verified Budget-mode actual value:

**Current Calculation (line 1101):**
```javascript
r.knownExpensesTotal = Number((r.cardPurchasesObserved + r.bankExpensesObserved).toFixed(2));
```

**This is the EXISTING verified Budget-mode actual that Phase 3 locked in.**

### **Why Not Sum Categorized Actuals?**

**Problem:** state.categoryActualByMonth only includes transactions with Chase Category:
- Bank transactions: 0 to N with Chase Category (varies by rule match)
- Credit card transactions: Only those with non-blank Chase Category field
- **Missing:** Transactions without category assignment still contribute to knownExpensesTotal

**Example:**
```
June Budget-mode Known Expenses: $4,200 (verified, locked)
  = Card purchases: $2,500 (from Chase feeds with categories)
  + Bank expenses: $1,700 (from bank CSV)
    (Some bank expenses may not have category rules)

Sum of categoryActualByMonth June: $4,100
  (Missing: $100 in uncategorized bank expenses)

Variance: $100 gap if you use only categorized sum
```

### **Correct Phase 5 Approach:**

**Overall Actual = knownExpensesTotal (existing verified value)**
- Includes all transactions (categorized + uncategorized)
- Already locked in Phase 3
- Used for KPI display + net calculation
- Consistent with annual tracking logic

**Categorized Actual (Detail) ≠ Overall Actual (Summary)**
- Sum of categoryActualByMonth is a DETAIL view
- May be < Overall Actual if uncategorized transactions exist
- Both should be displayed (different purposes)

---

## 4.3 PRESERVING DISTINCT LAYERS

### **Layer 1: Overall (KPI level)**
- **Budget:** $28,613.91 (from Budget.csv)
- **Actual:** knownExpensesTotal (from observed bank + card)
- **Variance:** Budget - Actual
- **Purpose:** "How much did I spend vs. my total budget?"

### **Layer 2: Categorized (Detail level)**
- **By Category:** Category Budget vs Category Actual (from state.categoryActualByMonth)
- **Category Chart:** Shows breakdown
- **Purpose:** "Where did my spending go?"

### **Layer 3: Informational Breakdown**
- **Card Spend:** cardPurchasesObserved (what was charged)
- **Bank Expenses:** bankExpensesObserved (what was debited)
- **Purpose:** "What was paid vs. purchased?"

---

# SECTION 5: PROPOSED UI CHANGES

## 5.1 MINIMUM CHANGE APPROACH

**Goal:** Add Budget vs Actual WITHOUT removing useful information

### **Option A: Replace "Baseline Expenses" with "Budget vs Actual" card**

**Current KPI Grid:**
```
[1] Income Total
[2] Known Expenses
[3] Net Result
[4] Card Spend (Info)
[5] Bank Expenses (Info)
[6] Baseline Expenses  ← REPLACE THIS
```

**Proposed KPI Grid:**
```
[1] Income Total
[2] Budget (Overall)
[3] Actual (Overall Categorized + Uncategorized)
[4] Budget vs Actual (Variance)
[5] Card Spend (Info)
[6] Bank Expenses (Info)
[7] Known Expenses (Mode-aware, shown in mode-diff panel)
```

**Changes:**
- Move "Baseline Expenses" to replaced by "Budget" (from Budget.csv)
- Add "Actual" KPI card (from knownExpensesTotal)
- Add "Budget vs Actual" card (variance = Budget - Actual)
- Keep "Card Spend" and "Bank Expenses" as informational breakdown
- Move "Known Expenses" to mode-diff panel (still useful for mode comparison)
- Keep "Income Total" and "Net Result"

---

### **Option B: Reorganize into two sections**

**Section 1: Budget vs Actual (New Primary Focus)**
```
[1] Income Total
[2] Monthly Budget (from Budget.csv)
[3] Monthly Actual (from observed spend)
[4] Variance (Budget - Actual)
```

**Section 2: Informational Context**
```
[5] Card Spend (Info)
[6] Bank Expenses (Info)
[7] Net Cash (Income - Actual)
```

**Changes:**
- Clear separation: comparison vs. context
- Highlights Budget vs Actual as primary KPI
- Maintains informational cards for spending breakdown
- Adds explicit "Net Cash" to clarify income impact

---

### **Option C: Compact layout (3-card row + detail row)**

**Primary Row:**
```
[1] Income Total          [2] Budget vs Actual         [3] Net (Income - Actual)
```

**Detail Row:**
```
[4] Monthly Budget        [5] Monthly Actual           [6] Budget         Actual        Variance
                                                        (detailed          (detailed)     cards
```

**Changes:**
- Emphasizes Income → Budget vs Actual → Net (main flow)
- Detail cards below for breakdown
- Maintains all information without clutter

---

## 5.2 RECOMMENDATIONS BY PRIORITY

### **Must Change:**
1. ✅ Replace "Baseline Expenses" source: Manual entry → Budget.csv sum ($28,613.91)
2. ✅ Add "Budget" KPI card displaying Budget.csv total
3. ✅ Add "Actual" KPI card displaying knownExpensesTotal
4. ✅ Add "Variance" KPI card showing Budget - Actual
5. ✅ Update annual tracking to use Budget.csv sum instead of row.baselineExpenses

### **Should Keep:**
1. ✅ Income Total (mode-independent, always useful)
2. ✅ Card Spend (Info) and Bank Expenses (Info) for breakdown
3. ✅ Net Result (clarify it's Income - Actual)
4. ✅ Mode-difference panel (still useful for Cashflow vs Budget comparison)

### **Can Deprecate:**
1. ⚠️ "Known Expenses" as KPI card (replace with Budget vs Actual comparison)
   - Keep calculation for mode-diff panel
   - Move display to mode-diff section

### **Category Chart:**
- ✅ Keep existing category-by-category Budget vs Actual chart
- Complements overall Budget vs Actual KPI

---

## 5.3 PROPOSED HTML STRUCTURE (No Implementation - Design Only)

```html
<!-- KPI GRID SECTION -->
<section class="kpi-grid" id="kpi-grid" data-route="dashboard">
  
  <!-- ROW 1: INCOME & NET POSITION -->
  <article class="kpi-card kpi-accent">
    <div class="kpi-label">Income Total</div>
    <div class="kpi-value" id="kpi-income">--</div>
  </article>

  <!-- ROW 2: BUDGET vs ACTUAL COMPARISON -->
  <article class="kpi-card">
    <div class="kpi-label">Monthly Budget</div>
    <div class="kpi-value" id="kpi-budget">--</div>
  </article>
  
  <article class="kpi-card">
    <div class="kpi-label">Monthly Actual</div>
    <div class="kpi-value" id="kpi-actual">--</div>
  </article>
  
  <article class="kpi-card kpi-variance">
    <div class="kpi-label">Budget vs Actual</div>
    <div class="kpi-value" id="kpi-variance">--</div>
  </article>

  <!-- ROW 3: INFORMATIONAL BREAKDOWN -->
  <article class="kpi-card">
    <div class="kpi-label">Card Spend (Info)</div>
    <div class="kpi-value" id="kpi-card">--</div>
  </article>
  
  <article class="kpi-card">
    <div class="kpi-label">Bank Expenses (Info)</div>
    <div class="kpi-value" id="kpi-bank">--</div>
  </article>

</section>

<!-- MODE CONTEXT PANEL (MOVED) -->
<section class="panel mode-context-panel" id="mode-context-panel" data-route="dashboard">
  <div class="panel-header">
    <h2>Mode-Aware Calculation Detail</h2>
  </div>
  <div class="known-expenses-display">
    <div>Known Expenses (Cashflow): --</div>
    <div>Known Expenses (Budget): --</div>
    <div class="mode-diff-note" id="mode-diff-note">--</div>
  </div>
</section>
```

---

## 5.4 STYLE CONSIDERATIONS

### **Color Coding (CSS Classes)**
- **kpi-budget:** Neutral blue (target, not judgment)
- **kpi-actual:** Neutral gray (observed fact)
- **kpi-variance:** 
  - Green if Budget > Actual (under budget = good)
  - Red if Budget < Actual (over budget = concern)
- **kpi-income:** Green (positive/accent as currently)
- **kpi-card, kpi-bank:** Neutral gray (informational)

---

# SECTION 6: IMPLEMENTATION CHECKLIST (DO NOT IMPLEMENT YET)

This is for Phase 5 implementation planning only:

- [ ] Update state object: Add budgetKpiValue field (or read from validation)
- [ ] Modify renderKpis() to:
  - [ ] Read Budget from state.budgetConfigValidation.sumAllBudgets
  - [ ] Keep Actual from row.knownExpensesTotal (no change needed)
  - [ ] Calculate Variance = Budget - Actual
  - [ ] Update #kpi-budget, #kpi-actual, #kpi-variance
  - [ ] Rearrange card order (Income → Budget → Actual → Variance → Card → Bank)
- [ ] Update HTML structure:
  - [ ] Add #kpi-budget card
  - [ ] Add #kpi-actual card
  - [ ] Add #kpi-variance card (with variance class for color coding)
  - [ ] Remove or hide #kpi-base card
  - [ ] Reorganize card order
- [ ] Update computeAnnualTracking():
  - [ ] Replace line 1566 to use state.budgetConfigValidation.sumAllBudget instead of row.baselineExpenses
- [ ] Update Profile UI:
  - [ ] Show read-only Budget.csv total instead of editable baselineBudget
  - [ ] Remove manual baseline budget entry field
- [ ] Update renderModeDifferenceCallout():
  - [ ] Move Known Expenses display to mode-context panel
- [ ] Test validation:
  - [ ] Budget appears as $28,613.91
  - [ ] Actual matches verified Budget-mode values
  - [ ] Variance calculation is correct
  - [ ] Mode-diff still works for Cashflow comparison
  - [ ] Annual tracking reflects Budget.csv total

---

# SECTION 7: KEY DECISIONS LOCKED FOR PHASE 5

1. ✅ **Overall Budget Source:** Budget.csv sum ($28,613.91) - NOT manual entry
2. ✅ **Overall Actual Source:** Existing knownExpensesTotal (verified Budget-mode) - NOT sum of categorized only
3. ✅ **Income Handling:** Keep independent, stays as first KPI card
4. ✅ **Mode Switching:** Keep knownExpensesTotal mode-aware, document distinction in mode-diff panel
5. ✅ **Categorized Actuals:** Display in detail section (Category Chart), separate from Overall KPI

---

# SECTION 8: ANALYSIS COMPLETE - READY FOR IMPLEMENTATION APPROVAL

**This analysis is ready for:**
1. User review and approval
2. UI mockup creation (Figma/design tool)
3. Code implementation phase (Phase 5 proper)

**No code changes have been made.** All changes are proposed for future implementation.
