const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/extract-pdf-text.js <input-pdf> <output-txt>');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(outputPath);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`Input PDF not found: ${resolvedInput}`);
    process.exit(1);
  }

  const outputDir = path.dirname(resolvedOutput);
  fs.mkdirSync(outputDir, { recursive: true });

  const dataBuffer = fs.readFileSync(resolvedInput);
  const parser = new PDFParse({ data: dataBuffer });
  const parsed = await parser.getText();
  await parser.destroy();
  fs.writeFileSync(resolvedOutput, parsed.text || '', 'utf8');

  console.log(`Extracted text: ${resolvedOutput}`);
  console.log(`Pages: ${parsed.numpages || 0}`);
  console.log(`Chars: ${(parsed.text || '').length}`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
