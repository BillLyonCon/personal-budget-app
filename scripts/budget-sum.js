const fs = require('fs');

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuote && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === ',' && !inQuote) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    return row;
  });
}

function cleanCurrencyValue(val) {
  if (!val) return 0;
  const str = String(val).trim();
  if (!str) return 0;
  const numeric = str.replace(/[$,]/g, '');
  const num = parseFloat(numeric);
  return isNaN(num) ? 0 : num;
}

const csv = fs.readFileSync('./data/config/Budget.csv', 'utf-8');
const rows = parseCsv(csv);

console.log('Budget.csv Analysis');
console.log('==================\n');
console.log('Total file rows: ' + csv.split(/\r?\n/).length);
console.log('Data rows parsed: ' + rows.length);
console.log('\nDetailed breakdown:');

let totalBudget = 0;
rows.forEach((row, idx) => {
  const budget = cleanCurrencyValue(row['Monthy Budget'] || row['Monthly Budget']);
  totalBudget += budget;
  console.log(`Row ${idx+2}: ${row.Category.padEnd(25)} | ${row.Subcategory.padEnd(30)} | $${budget.toFixed(2).padStart(10)}`);
});

console.log('\n' + '='.repeat(80));
console.log(`TOTAL MONTHLY BUDGET: $${totalBudget.toFixed(2)}`);
console.log(`\nVerification: 23 rows expected`);
console.log(`Rows found: ${rows.length}`);
console.log(`Status: ${rows.length === 23 ? 'CORRECT' : 'MISMATCH'}`);
