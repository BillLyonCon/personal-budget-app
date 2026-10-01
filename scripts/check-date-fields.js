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

function toNum(str) {
  const s = String(str || "").trim();
  if (!s) return 0;
  const numeric = s.replace(/[$,]/g, '');
  const num = parseFloat(numeric);
  return isNaN(num) ? 0 : num;
}

function parseDateToMonth(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

const csv = fs.readFileSync('./data/raw/Chase2674_Activity_20260816.csv', 'utf-8');
const rows = parseCsv(csv);

console.log('=== EXAMINING $80.68 PUBLIX TRANSACTION ===\n');

rows.forEach((row, idx) => {
  const amount = toNum(row.Amount);
  if (Math.abs(amount - 80.68) < 0.01 && row.Description.includes('PUBLIX')) {
    console.log(`Row ${idx + 2} (CSV line ${idx + 2}):`);
    console.log(`  Transaction Date: "${row['Transaction Date']}" -> Month: ${parseDateToMonth(row['Transaction Date'])}`);
    console.log(`  Post Date:        "${row['Post Date']}" -> Month: ${parseDateToMonth(row['Post Date'])}`);
    console.log(`  Description:      "${row.Description}"`);
    console.log(`  Amount:           $${Math.abs(amount).toFixed(2)}`);
    console.log(`  Category:         "${row.Category}"`);
    console.log(`  Type:             "${row.Type}"`);
    console.log();
    console.log('Both dates resolve to:');
    console.log(`  Transaction Date → ${parseDateToMonth(row['Transaction Date'])}`);
    console.log(`  Post Date        → ${parseDateToMonth(row['Post Date'])}`);
  }
});

console.log('\n=== EXAMINING $8.00 FOOD & DRINK TRANSACTIONS ===\n');

let found8 = false;
rows.forEach((row, idx) => {
  const amount = toNum(row.Amount);
  const cat = row.Category || '';
  if (Math.abs(Math.abs(amount) - 8.00) < 0.01 && (cat.includes('Food') || cat.includes('Drink'))) {
    console.log(`Row ${idx + 2}:`);
    console.log(`  Transaction Date: "${row['Transaction Date']}" -> Month: ${parseDateToMonth(row['Transaction Date'])}`);
    console.log(`  Post Date:        "${row['Post Date']}" -> Month: ${parseDateToMonth(row['Post Date'])}`);
    console.log(`  Description:      "${row.Description}"`);
    console.log(`  Amount:           $${Math.abs(amount).toFixed(2)}`);
    console.log(`  Category:         "${cat}"`);
    console.log();
    found8 = true;
  }
});

if (!found8) {
  console.log('$8.00 exact match not found. Searching $7.99-$8.01...\n');
  rows.forEach((row, idx) => {
    const amount = toNum(row.Amount);
    const cat = row.Category || '';
    if (Math.abs(amount) >= 7.99 && Math.abs(amount) <= 8.01 && (cat.includes('Food') || cat.includes('Drink') || row.Description.toLowerCase().includes('food') || row.Description.toLowerCase().includes('drink'))) {
      console.log(`Row ${idx + 2}:`);
      console.log(`  Transaction Date: "${row['Transaction Date']}" -> Month: ${parseDateToMonth(row['Transaction Date'])}`);
      console.log(`  Post Date:        "${row['Post Date']}" -> Month: ${parseDateToMonth(row['Post Date'])}`);
      console.log(`  Description:      "${row.Description}"`);
      console.log(`  Amount:           $${Math.abs(amount).toFixed(2)}`);
      console.log(`  Category:         "${cat}"`);
      console.log();
    }
  });
}
