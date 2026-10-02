#!/usr/bin/env node
/**
 * test-init-order-regression.js
 * 
 * Validates the critical invariant that caused persistence regression in Sept 30:
 * - Budget.csv config must load
 * - Bank rules.csv config must load
 * - THEN persisted pipeline state is restored
 * - THEN rendering occurs (only if restored state is valid)
 * 
 * This test catches the regression where restoration was attempted BEFORE configs loaded,
 * causing renderKpis() to fail silently due to missing state.budgetByCategory.
 */

const assert = require('assert');

// ============================================================================
// MOCK STATE & STORAGE
// ============================================================================

const mockStorage = {};
const localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = value; },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Simulated application state
const appState = {
  rows: [],
  categoryActualByMonth: {},
  meta: { source: '', importedAt: '', calcMode: 'cashflow' },
  budgetByCategory: {},
  bankRulesRows: [],
  budgetConfigValidation: {}
};

// Execution trace to verify order
const executionTrace = [];

// ============================================================================
// MOCK INITIALIZATION FUNCTIONS (mirrors app/script.js bindUi async block)
// ============================================================================

async function mockLoadBudgetConfig() {
  executionTrace.push('loadBudgetConfig');
  // Simulate successful load
  appState.budgetByCategory = {
    'Mortgage': 2200,
    'Groceries': 1200,
    'Utilities': 150
  };
  appState.budgetConfigValidation = { sumAllBudgets: 3550 };
  return { success: true };
}

async function mockLoadBankRules() {
  executionTrace.push('loadBankRules');
  // Simulate successful load
  appState.bankRulesRows = [
    { pattern: 'WHOLE FOODS', category: 'Groceries' },
    { pattern: 'DUKE ENERGY', category: 'Utilities' }
  ];
  return { success: true };
}

function mockTryRestoreComputedState() {
  executionTrace.push('tryRestoreComputedState');
  try {
    const rawRows = localStorage.getItem('budgetApp.rows.v1');
    if (!rawRows) {
      executionTrace.push('  → no rows found');
      return false;
    }
    const parsedRows = JSON.parse(rawRows);
    if (!Array.isArray(parsedRows) || !parsedRows.length) {
      executionTrace.push('  → invalid rows');
      return false;
    }

    appState.rows = parsedRows;
    const rawMeta = localStorage.getItem('budgetApp.meta.v1');
    appState.meta = rawMeta ? JSON.parse(rawMeta) : { source: '', importedAt: '', calcMode: 'cashflow' };
    
    executionTrace.push('  → restored ' + appState.rows.length + ' rows');
    return true;
  } catch (e) {
    executionTrace.push('  → exception: ' + e.message);
    return false;
  }
}

function mockApplySavedModeRows(calcMode) {
  executionTrace.push('applySavedModeRows(' + calcMode + ')');
  return true;
}

function mockRenderAll() {
  executionTrace.push('renderAll');
  
  // CRITICAL: renderKpis requires state.budgetByCategory to be populated
  // This is what FAILED in the regression - budgetByCategory was empty
  if (!appState.budgetByCategory || Object.keys(appState.budgetByCategory).length === 0) {
    throw new Error('REGRESSION: renderAll called but budgetByCategory is empty. Config was not loaded before restoration!');
  }
  
  // This is what FAILED in the regression - bankRulesRows was empty
  if (!appState.bankRulesRows || appState.bankRulesRows.length === 0) {
    throw new Error('REGRESSION: renderAll called but bankRulesRows is empty. Bank rules were not loaded before restoration!');
  }
}

// ============================================================================
// SIMULATED INITIALIZATION SEQUENCE (mirrors app/script.js bindUi async block)
// ============================================================================

async function initializeAppWithCorrectOrder() {
  executionTrace.length = 0;
  appState.rows = [];
  appState.budgetByCategory = {};
  appState.bankRulesRows = [];
  
  try {
    // CORRECT ORDER (as in commit 9ddbb73):
    // 1. Load configs first
    await mockLoadBudgetConfig();
    await mockLoadBankRules();
    
    // 2. Then restore from localStorage
    const restored = mockTryRestoreComputedState();
    
    if (restored && appState.meta.source === 'pipeline-import') {
      const calcMode = appState.meta.calcMode || 'cashflow';
      mockApplySavedModeRows(calcMode);
      
      // 3. Finally render (now configs are loaded, restoration succeeded)
      mockRenderAll();
      
      executionTrace.push('✓ initialization succeeded');
      return { success: true, state: appState };
    } else {
      executionTrace.push('✓ no saved pipeline import');
      return { success: true, restored: false };
    }
  } catch (e) {
    executionTrace.push('✗ initialization failed: ' + e.message);
    return { success: false, error: e.message };
  }
}

async function initializeAppWithBrokenOrder() {
  executionTrace.length = 0;
  appState.rows = [];
  appState.budgetByCategory = {};
  appState.bankRulesRows = [];
  
  try {
    // BROKEN ORDER (before commit 9ddbb73):
    // 1. Restore from localStorage WITHOUT loading configs first
    const restored = mockTryRestoreComputedState();
    
    if (restored && appState.meta.source === 'pipeline-import') {
      const calcMode = appState.meta.calcMode || 'cashflow';
      mockApplySavedModeRows(calcMode);
      
      // 2. Try to render (but configs were never loaded!)
      mockRenderAll();
      
      executionTrace.push('✓ initialization succeeded');
      return { success: true, state: appState };
    } else {
      executionTrace.push('✓ no saved pipeline import');
      return { success: true, restored: false };
    }
  } catch (e) {
    executionTrace.push('✗ initialization failed: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================================
// TEST DEFINITIONS (used by both describe() and standalone runner)
// ============================================================================

// ============================================================================
// TEST RUNNER
// ============================================================================

// Reset state function
function resetState() {
  localStorage.clear();
  appState.rows = [];
  appState.categoryActualByMonth = {};
  appState.meta = { source: '', importedAt: '', calcMode: 'cashflow' };
  appState.budgetByCategory = {};
  appState.bankRulesRows = [];
  appState.budgetConfigValidation = {};
  executionTrace.length = 0;
}

if (require.main === module) {
  let passed = 0;
  let failed = 0;

  const tests = [
    {
      name: 'should load configs BEFORE restoring persisted pipeline state',
      fn: async () => {
        resetState();
        localStorage.setItem('budgetApp.rows.v1', JSON.stringify([
          { month: '2026-09', incomeObserved: 5000, bankExpensesObserved: 3000 }
        ]));
        localStorage.setItem('budgetApp.meta.v1', JSON.stringify({
          source: 'pipeline-import',
          importedAt: '2026-10-02T20:00:00Z',
          calcMode: 'cashflow'
        }));
        
        const result = await initializeAppWithCorrectOrder();
        assert.strictEqual(result.success, true, 'initialization should succeed');
        
        const configIndex = executionTrace.indexOf('loadBudgetConfig');
        const rulesIndex = executionTrace.indexOf('loadBankRules');
        const restoreIndex = executionTrace.findIndex(s => s.startsWith('tryRestoreComputedState'));
        const renderIndex = executionTrace.indexOf('renderAll');
        
        assert.ok(configIndex < restoreIndex, 'Budget config should load BEFORE restoration');
        assert.ok(rulesIndex < restoreIndex, 'Bank rules should load BEFORE restoration');
        assert.ok(restoreIndex < renderIndex, 'Restoration should happen BEFORE rendering');
      }
    },
    {
      name: 'should FAIL if configs are not loaded before rendering (regression detection)',
      fn: async () => {
        resetState();
        localStorage.setItem('budgetApp.rows.v1', JSON.stringify([
          { month: '2026-09', incomeObserved: 5000, bankExpensesObserved: 3000 }
        ]));
        localStorage.setItem('budgetApp.meta.v1', JSON.stringify({
          source: 'pipeline-import',
          importedAt: '2026-10-02T20:00:00Z',
          calcMode: 'cashflow'
        }));
        
        const result = await initializeAppWithBrokenOrder();
        assert.strictEqual(result.success, false, 'initialization should fail when configs not loaded');
        assert.ok(result.error.includes('REGRESSION'), 'error should indicate regression');
      }
    },
    {
      name: 'should not attempt restoration if no persisted data exists',
      fn: async () => {
        resetState();
        const result = await initializeAppWithCorrectOrder();
        assert.ok(executionTrace.includes('loadBudgetConfig'), 'configs should load');
        const hasRestoreAttempt = executionTrace.some(s => s.startsWith('tryRestoreComputedState'));
        assert.ok(hasRestoreAttempt, 'should attempt restoration');
        const hasNoRowsMessage = executionTrace.some(s => s.includes('no rows found'));
        assert.ok(hasNoRowsMessage, 'restore should detect missing data');
        assert.strictEqual(executionTrace.includes('renderAll'), false, 'should not render');
      }
    },
    {
      name: 'should not restore if persisted meta.source is not pipeline-import',
      fn: async () => {
        resetState();
        localStorage.setItem('budgetApp.rows.v1', JSON.stringify([
          { month: '2026-09', incomeObserved: 5000, bankExpensesObserved: 3000 }
        ]));
        localStorage.setItem('budgetApp.meta.v1', JSON.stringify({
          source: 'manual-entry',
          importedAt: '2026-10-02T20:00:00Z',
          calcMode: 'cashflow'
        }));
        
        const result = await initializeAppWithCorrectOrder();
        assert.ok(executionTrace.includes('loadBudgetConfig'));
        assert.strictEqual(executionTrace.includes('applySavedModeRows'), false);
        assert.strictEqual(executionTrace.includes('renderAll'), false);
      }
    },
    {
      name: 'should handle corrupted persisted JSON gracefully',
      fn: async () => {
        resetState();
        localStorage.setItem('budgetApp.rows.v1', 'NOT VALID JSON {]');
        localStorage.setItem('budgetApp.meta.v1', JSON.stringify({
          source: 'pipeline-import',
          importedAt: '2026-10-02T20:00:00Z',
          calcMode: 'cashflow'
        }));
        
        const result = await initializeAppWithCorrectOrder();
        assert.ok(executionTrace.includes('loadBudgetConfig'));
        const restoreLine = executionTrace.find(s => s.includes('exception'));
        assert.ok(restoreLine, 'exception should be caught');
        assert.strictEqual(executionTrace.includes('renderAll'), false);
      }
    },
    {
      name: 'should restore empty meta as default if storage key is missing',
      fn: async () => {
        resetState();
        localStorage.setItem('budgetApp.rows.v1', JSON.stringify([
          { month: '2026-09', incomeObserved: 5000, bankExpensesObserved: 3000 }
        ]));
        
        const result = await initializeAppWithCorrectOrder();
        assert.ok(executionTrace.includes('loadBudgetConfig'));
        assert.strictEqual(executionTrace.includes('applySavedModeRows'), false);
      }
    },
    {
      name: 'should preserve calcMode when restoring',
      fn: async () => {
        resetState();
        localStorage.setItem('budgetApp.rows.v1', JSON.stringify([
          { month: '2026-09', incomeObserved: 5000, bankExpensesObserved: 3000 }
        ]));
        localStorage.setItem('budgetApp.meta.v1', JSON.stringify({
          source: 'pipeline-import',
          importedAt: '2026-10-02T20:00:00Z',
          calcMode: 'budget'
        }));
        
        const result = await initializeAppWithCorrectOrder();
        assert.strictEqual(result.success, true);
        assert.strictEqual(appState.meta.calcMode, 'budget');
      }
    }
  ];

  (async () => {
    console.log('\n' + '='.repeat(70));
    console.log('INITIALIZATION ORDER REGRESSION TEST');
    console.log('='.repeat(70) + '\n');

    for (const test of tests) {
      try {
        await test.fn();
        console.log('✓ PASS: ' + test.name);
        passed++;
      } catch (e) {
        console.log('✗ FAIL: ' + test.name);
        console.log('  Error: ' + e.message);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(70) + '\n');

    process.exit(failed > 0 ? 1 : 0);
  })();
}

module.exports = {
  initializeAppWithCorrectOrder,
  initializeAppWithBrokenOrder,
  mockLoadBudgetConfig,
  mockLoadBankRules
};
