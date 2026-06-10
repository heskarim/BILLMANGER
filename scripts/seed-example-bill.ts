/**
 * seed-example-bill.ts
 * Run with: npx tsx scripts/seed-example-bill.ts
 *
 * Creates:
 *   - 1 demo client
 *   - 25 products (lab/tech equipment)
 *   - 1 realistic 25-line-item FACTURE bill
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'billing.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// 1. Ensure tables exist (mirrors initDb from db.ts)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT NOT NULL, address TEXT NOT NULL,
    phone TEXT NOT NULL, email TEXT NOT NULL,
    rc TEXT NOT NULL, art TEXT NOT NULL,
    nif TEXT NOT NULL, nis TEXT NOT NULL,
    rib TEXT NOT NULL, logo TEXT
  );
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, address TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL, description TEXT,
    unit TEXT DEFAULT 'UN', default_price REAL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT UNIQUE NOT NULL,
    type TEXT CHECK(type IN ('facture','proforma','livraison')) NOT NULL,
    date TEXT NOT NULL, contract_number TEXT, contract_date TEXT,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    client_name_snapshot TEXT NOT NULL, client_address_snapshot TEXT NOT NULL,
    client_code_snapshot TEXT NOT NULL,
    tva_rate REAL DEFAULT 19, montant_ht REAL NOT NULL,
    montant_ttc REAL NOT NULL, amount_in_words TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL, unit TEXT NOT NULL,
    quantity REAL NOT NULL, unit_price REAL NOT NULL,
    total_price REAL NOT NULL, sort_order INTEGER NOT NULL
  );
`);

// ---------------------------------------------------------------------------
// 2. Demo client
// ---------------------------------------------------------------------------
const CLIENT = {
  code: 'C-DEMO',
  name: 'Université des Sciences et Technologies Houari Boumediene',
  address: 'BP 32 El Alia, Bab Ezzouar, Alger 16111, Algérie',
};

const existingClient = db.prepare('SELECT id FROM clients WHERE code = ?').get(CLIENT.code) as { id: number } | undefined;
let clientId: number;

if (existingClient) {
  clientId = existingClient.id;
  db.prepare('UPDATE clients SET name = @name, address = @address WHERE id = @id')
    .run({ ...CLIENT, id: clientId });
  console.log(`✔  Client already exists (id=${clientId}), updated.`);
} else {
  const r = db.prepare('INSERT INTO clients (code, name, address) VALUES (@code, @name, @address)').run(CLIENT);
  clientId = r.lastInsertRowid as number;
  console.log(`✔  Client created (id=${clientId}).`);
}

// ---------------------------------------------------------------------------
// 3. 25 product catalog entries
// ---------------------------------------------------------------------------
const PRODUCTS = [
  { name: 'Microscope optique binoculaire',       description: 'Grossissement x40-x1600, éclairage LED',    unit: 'UN',  default_price: 450000 },
  { name: 'Balance analytique 0.0001g',           description: 'Capacité 220 g, précision 0.1 mg',          unit: 'UN',  default_price: 320000 },
  { name: 'Étuve de laboratoire 250°C',           description: 'Volume 54L, régulation PID',                unit: 'UN',  default_price: 185000 },
  { name: 'Agitateur magnétique chauffant',       description: 'Vitesse 0-1600 tr/min, T° max 340°C',       unit: 'UN',  default_price: 95000  },
  { name: 'pH-mètre de paillasse',                description: 'Résolution 0.01 pH, avec électrode',        unit: 'UN',  default_price: 220000 },
  { name: 'Conductivimètre de table',             description: 'Plage 0.01 µS/cm – 200 mS/cm',             unit: 'UN',  default_price: 280000 },
  { name: 'Centrifugeuse de paillasse',           description: '12 000 tr/min, 24 tubes × 1.5 mL',         unit: 'UN',  default_price: 560000 },
  { name: 'Spectrophotomètre UV-Vis',             description: 'Plage 190-1100 nm, double faisceau',        unit: 'UN',  default_price: 1200000},
  { name: 'Réfrigérateur de laboratoire 4°C',    description: '300 L, alarme température',                 unit: 'UN',  default_price: 390000 },
  { name: 'Hotte aspirante chimique 1.5m',        description: 'Débit 500 m³/h, châssis inox',             unit: 'UN',  default_price: 850000 },
  { name: 'Dessiccateur en verre Ø300mm',         description: 'Avec robinet et plateau porcelaine',        unit: 'UN',  default_price: 120000 },
  { name: 'Burette automatique 50 mL',            description: 'Classe A, précision ±0.05 mL',             unit: 'UN',  default_price: 45000  },
  { name: 'Pissette souple LDPE 500 mL',         description: 'Pour solvants et eau distillée',            unit: 'PC',  default_price: 1200   },
  { name: 'Bécher en verre borosilicate 500 mL', description: 'Graduation imprimée, forme haute',          unit: 'PC',  default_price: 3500   },
  { name: 'Fiole jaugée 1000 mL classe A',        description: 'Col rodé, bouchon PP',                     unit: 'PC',  default_price: 8500   },
  { name: 'Erlenmeyer avec bouchon 500 mL',      description: 'Verre borosilicate 3.3',                    unit: 'PC',  default_price: 4200   },
  { name: 'Pipette graduée 10 mL',               description: 'Classe A, 1/10 de graduation',              unit: 'PC',  default_price: 2800   },
  { name: 'Propipette à 3 voies',                description: 'En caoutchouc naturel',                     unit: 'PC',  default_price: 3200   },
  { name: 'Plaque chauffante 300×300mm',          description: 'Surface céramique, T° max 500°C',           unit: 'UN',  default_price: 75000  },
  { name: 'Thermomètre digital -50°C/300°C',     description: 'Précision ±0.5°C, sonde inox 1 m',          unit: 'UN',  default_price: 18500  },
  { name: 'Gants nitrile bleus L (boîte 100)',   description: 'Épaisseur 0.1 mm, sans poudre',             unit: 'BT',  default_price: 2800   },
  { name: 'Papier filtre Whatman N°1 Ø185mm',    description: 'Boîte 100 filtres, rétention 11 µm',        unit: 'BT',  default_price: 4500   },
  { name: 'Acide sulfurique 98% 2.5L',           description: 'Qualité analytique ACS, bidon HDPE',        unit: 'BT',  default_price: 12000  },
  { name: 'Hydroxyde de sodium granulés 1kg',    description: 'Pureté ≥98%, pot HDPE hermétique',          unit: 'KG',  default_price: 3800   },
  { name: 'Chlorure de sodium extra-pur 500g',   description: 'NaCl ≥99.8%, flacon verre ambre',           unit: 'UN',  default_price: 5500   },
];

const insertProd = db.prepare(`
  INSERT INTO products (name, description, unit, default_price)
  VALUES (@name, @description, @unit, @default_price)
  ON CONFLICT(name) DO UPDATE SET
    description  = excluded.description,
    unit         = excluded.unit,
    default_price = excluded.default_price
`);

db.transaction(() => {
  for (const p of PRODUCTS) insertProd.run(p);
})();

console.log(`✔  ${PRODUCTS.length} products upserted into catalog.`);

// ---------------------------------------------------------------------------
// 4. Build 25 line items
// ---------------------------------------------------------------------------
const LINE_ITEMS = [
  { product_name: 'Microscope optique binoculaire',       unit: 'UN',  quantity: 2,   unit_price: 450000  },
  { product_name: 'Balance analytique 0.0001g',           unit: 'UN',  quantity: 1,   unit_price: 320000  },
  { product_name: 'Étuve de laboratoire 250°C',           unit: 'UN',  quantity: 1,   unit_price: 185000  },
  { product_name: 'Agitateur magnétique chauffant',       unit: 'UN',  quantity: 3,   unit_price: 95000   },
  { product_name: 'pH-mètre de paillasse',                unit: 'UN',  quantity: 2,   unit_price: 220000  },
  { product_name: 'Conductivimètre de table',             unit: 'UN',  quantity: 1,   unit_price: 280000  },
  { product_name: 'Centrifugeuse de paillasse',           unit: 'UN',  quantity: 1,   unit_price: 560000  },
  { product_name: 'Spectrophotomètre UV-Vis',             unit: 'UN',  quantity: 1,   unit_price: 1200000 },
  { product_name: 'Réfrigérateur de laboratoire 4°C',    unit: 'UN',  quantity: 1,   unit_price: 390000  },
  { product_name: 'Hotte aspirante chimique 1.5m',        unit: 'UN',  quantity: 1,   unit_price: 850000  },
  { product_name: 'Dessiccateur en verre Ø300mm',         unit: 'UN',  quantity: 2,   unit_price: 120000  },
  { product_name: 'Burette automatique 50 mL',            unit: 'UN',  quantity: 4,   unit_price: 45000   },
  { product_name: 'Pissette souple LDPE 500 mL',         unit: 'PC',  quantity: 20,  unit_price: 1200    },
  { product_name: 'Bécher en verre borosilicate 500 mL', unit: 'PC',  quantity: 30,  unit_price: 3500    },
  { product_name: 'Fiole jaugée 1000 mL classe A',        unit: 'PC',  quantity: 10,  unit_price: 8500    },
  { product_name: 'Erlenmeyer avec bouchon 500 mL',      unit: 'PC',  quantity: 15,  unit_price: 4200    },
  { product_name: 'Pipette graduée 10 mL',               unit: 'PC',  quantity: 25,  unit_price: 2800    },
  { product_name: 'Propipette à 3 voies',                unit: 'PC',  quantity: 10,  unit_price: 3200    },
  { product_name: 'Plaque chauffante 300×300mm',          unit: 'UN',  quantity: 2,   unit_price: 75000   },
  { product_name: 'Thermomètre digital -50°C/300°C',     unit: 'UN',  quantity: 5,   unit_price: 18500   },
  { product_name: 'Gants nitrile bleus L (boîte 100)',   unit: 'BT',  quantity: 10,  unit_price: 2800    },
  { product_name: 'Papier filtre Whatman N°1 Ø185mm',    unit: 'BT',  quantity: 5,   unit_price: 4500    },
  { product_name: 'Acide sulfurique 98% 2.5L',           unit: 'BT',  quantity: 3,   unit_price: 12000   },
  { product_name: 'Hydroxyde de sodium granulés 1kg',    unit: 'KG',  quantity: 10,  unit_price: 3800    },
  { product_name: 'Chlorure de sodium extra-pur 500g',   unit: 'UN',  quantity: 6,   unit_price: 5500    },
].map((item, i) => ({
  ...item,
  total_price: item.quantity * item.unit_price,
  sort_order: i + 1,
}));

const montant_ht = LINE_ITEMS.reduce((s, i) => s + i.total_price, 0);
const tva_rate   = 0;   // TVA exempted
const montant_ttc = montant_ht;

// ---------------------------------------------------------------------------
// 5. Determine the next bill number
// ---------------------------------------------------------------------------
const year = new Date().getFullYear();
const lastBill = db.prepare(`SELECT bill_number FROM bills WHERE bill_number LIKE ? ORDER BY id DESC LIMIT 1`)
  .get(`${year}-%`) as { bill_number: string } | undefined;

let nextNum = '0001';
if (lastBill) {
  const parts = lastBill.bill_number.split('-');
  if (parts.length === 2) {
    nextNum = (parseInt(parts[1], 10) + 1).toString().padStart(4, '0');
  }
}
const bill_number = `${year}-${nextNum}`;

// ---------------------------------------------------------------------------
// 6. Insert the bill + items in a transaction
// ---------------------------------------------------------------------------
const insertBill = db.prepare(`
  INSERT INTO bills (
    bill_number, type, date, contract_number, contract_date,
    client_id, client_name_snapshot, client_address_snapshot, client_code_snapshot,
    tva_rate, montant_ht, montant_ttc, amount_in_words
  ) VALUES (
    @bill_number, @type, @date, @contract_number, @contract_date,
    @client_id, @client_name_snapshot, @client_address_snapshot, @client_code_snapshot,
    @tva_rate, @montant_ht, @montant_ttc, @amount_in_words
  )
`);

const insertItem = db.prepare(`
  INSERT INTO bill_items (bill_id, product_name, unit, quantity, unit_price, total_price, sort_order)
  VALUES (@bill_id, @product_name, @unit, @quantity, @unit_price, @total_price, @sort_order)
`);

let billId = 0;

db.transaction(() => {
  const info = insertBill.run({
    bill_number,
    type: 'facture',
    date: new Date().toISOString().split('T')[0],
    contract_number: '47',
    contract_date: `${year}-01-15`,
    client_id: clientId,
    client_name_snapshot: CLIENT.name,
    client_address_snapshot: CLIENT.address,
    client_code_snapshot: CLIENT.code,
    tva_rate,
    montant_ht,
    montant_ttc,
    amount_in_words: `${montant_ttc.toLocaleString('fr-DZ')} Dinars Algériens`,
  });
  billId = info.lastInsertRowid as number;

  for (const item of LINE_ITEMS) {
    insertItem.run({ ...item, bill_id: billId });
  }
})();

console.log(`\n✅  Example bill created successfully!`);
console.log(`   Bill number : ${bill_number}`);
console.log(`   Bill ID     : ${billId}`);
console.log(`   Items       : ${LINE_ITEMS.length}`);
console.log(`   Montant HT  : ${montant_ht.toLocaleString('fr-DZ')} DA`);
console.log(`\n   ➜ Open http://localhost:5173/bills/${billId} to view it.\n`);

db.close();
