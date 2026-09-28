# localStorage Persistence Fix — 2026-09-01

## Problem

After importing pipeline data (bank + credit card CSVs), the dashboard displayed all 25 months correctly. However, on page reload or browser restart, all data was lost, showing "No data loaded yet" again.

**Evidence:**
- Dashboard displayed data immediately after import ✅
- Data visible in app memory (state.categoryActualByMonth, state.rows)
- `localStorage.getItem("budgetApp.categoryActualByMonth.v2")` returned null
- CSV files themselves persisted in `data/raw/` (proved files survived)
- Imported app state did NOT survive reload

## Root Cause

**Missing Initialization Logic in `bindUi()` Function**

The application initialization sequence was broken:
1. Page loads → `bindUi()` called (line 1685 in app/script.js)
2. `bindUi()` set up event listeners
3. ❌ **BUT NEVER called `loadVendorMapping()`**
4. ❌ **BUT NEVER called `tryRestoreComputedState()`**
5. ❌ **BUT NEVER called `renderAll()`**

Result: localStorage was never read on page load. Data only restored when user manually clicked "Show Results in UI" (which triggered `runRawImports()`, which called restoration logic).

**Why Snapshots Were Removed:**
The legacy snapshot workflow had fallback persistence (disk file + localStorage). When snapshots were removed in 2026-08-28, the disk fallback was eliminated but the initialization logic was never added to the new pipeline-only approach.

## Solution

Updated `bindUi()` function to initialize on page load:

```javascript
function bindUi() {
  state.profile = loadProfileFromStorage();
  updateBrandingFromProfile();
  applyProfileToUi();

  // Load vendor mapping and attempt to restore last pipeline import
  loadVendorMapping().then(() => {
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
      setStatus("No data loaded. Use Import Pipeline to upload statements.");
    }
  }).catch((err) => {
    console.warn("Failed to initialize:", err);
    setStatus("No data loaded. Use Import Pipeline to upload statements.");
  });

  // ... rest of event listener bindings ...
}
```

**What This Does:**
1. After profile loads, asynchronously load vendor mapping
2. Once vendor mapping ready, attempt to restore from localStorage
3. If restoration successful AND source is pipeline import:
   - Apply saved calculation mode (cashflow or budget)
   - Restore mode-specific rows from cache
   - Render all UI with data
   - Display status message with restoration timestamp
4. If restoration fails or no saved import:
   - Display "No data loaded" status
   - User proceeds to Import Pipeline tab

## Verification

✅ **Browser Restart Test (2026-09-01):**
- Imported August 2026 data via pipeline
- Dashboard displayed: 25 months, all KPI values, trend chart
- **Closed browser completely**
- **Reopened application**
- ✅ **Dashboard restored automatically** with same data
- Status message: "Restored last pipeline import (cashflow mode) from 8/30/2026, 10:02:00 PM"
- All 25 months still visible
- No re-import needed

## Data Persistence Guarantee

**Real data only** — No snapshot fallback:
- Pipeline imports write to localStorage
- Page reload restores from localStorage automatically
- If localStorage cleared (private mode, browser reset, cache clear):
  - Shows "No data loaded yet"
  - User must re-import CSV files
  - No phantom/stale data displayed

## Files Modified

- `app/script.js` — Updated `bindUi()` function (lines 1590-1621)

## Impact

- ✅ Pipeline data now survives page reload and browser restart
- ✅ Automatic restoration on load (no manual click needed)
- ✅ Maintains data integrity (no snapshot fallback to confuse users)
- ✅ Ready for chart integration — test-chart.html can now use real localStorage data
- ✅ Unblocks Category Budget vs Actual chart implementation

## Next Steps

1. Verify chart sandbox (test-chart.html) can load real data from localStorage
2. Diagnose cascade failure blocking main app chart integration
3. Integrate chart into renderKpis() on Months tab
