/**
 * seed-company-profile.ts
 * Run with: npx tsx scripts/seed-company-profile.ts
 *
 * Upserts the real TECH IP company profile into the settings table.
 * Safe to re-run: this updates an existing row or inserts a new one.
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'billing.db');
const db = new Database(dbPath);

const PROFILE = {
  id: 1,
  company_name: 'TECH IP',
  address: 'Lotissement souffey N 01 Khemis Miliana',
  phone: '(+213) 699847473',
  email: 'ghebache05110@gmail.com',
  rc: '44/00-3875390.A.26',
  art: '',
  nif: '15802060020146504400',
  nis: '795802060020144',
  rib: '00300281000156530079 BADR Agence khemis-miliana 281 GHEBACHE ABDELKADER',
};

const upsert = db.prepare(`
  INSERT INTO settings (id, company_name, address, phone, email, rc, art, nif, nis, rib, logo)
  VALUES (@id, @company_name, @address, @phone, @email, @rc, @art, @nif, @nis, @rib, NULL)
  ON CONFLICT(id) DO UPDATE SET
    company_name = excluded.company_name,
    address      = excluded.address,
    phone        = excluded.phone,
    email        = excluded.email,
    rc           = excluded.rc,
    art          = excluded.art,
    nif          = excluded.nif,
    nis          = excluded.nis,
    rib          = excluded.rib
`);

upsert.run(PROFILE);

console.log('✔  TECH IP company profile upserted into settings.');
console.log(JSON.stringify(PROFILE, null, 2));

db.close();
