import XLSX from 'xlsx-js-style';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/inspect-bill-export.ts <file.xlsx>');
  process.exit(1);
}

const workbook = XLSX.readFile(file, { cellStyles: true });
console.log(`Sheets: ${workbook.SheetNames.join(', ')}`);
for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  console.log(`\n[${name}]`);
  console.log(`ref: ${sheet['!ref'] ?? '(missing)'}`);
  console.log(`merges: ${(sheet['!merges'] ?? []).length}`);
  console.log(`cols: ${JSON.stringify(sheet['!cols'] ?? [])}`);
  console.log(`printArea: ${sheet['!printArea'] ?? '(missing)'}`);
  console.log(`rows: ${JSON.stringify(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }).slice(0, 18))}`);
}
