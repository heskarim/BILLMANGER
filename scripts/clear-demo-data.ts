/**
 * clear-demo-data.ts
 * Run with: npx tsx scripts/clear-demo-data.ts
 *
 * Removes all demo data so the user starts fresh in development:
 *   - Deletes all bill items
 *   - Deletes all bills
 *   - Deletes all clients
 *   - Deletes all products
 * Keeps the real TECH IP company profile (settings row id=1).
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'billing.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const counts = {
  items:    (db.prepare('SELECT COUNT(*) as c FROM bill_items').get() as { c: number }).c,
  bills:    (db.prepare('SELECT COUNT(*) as c FROM bills').get() as { c: number }).c,
  clients:  (db.prepare('SELECT COUNT(*) as c FROM clients').get() as { c: number }).c,
  products: (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c,
};

db.transaction(() => {
  db.exec('DELETE FROM bill_items');
  db.exec('DELETE FROM bills');
  db.exec('DELETE FROM clients');
  db.exec('DELETE FROM products');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('bill_items','bills','clients','products')");
})();

console.log('✔  Demo data cleared.');
console.log('   removed:', counts);
console.log('   kept   : settings row (TECH IP company profile)');

db.close();
