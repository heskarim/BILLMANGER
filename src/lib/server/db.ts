import Database from 'better-sqlite3';
import { join } from 'path';

// Store the database file at the root of the project
const dbPath = join(process.cwd(), 'billing.db');
const db = new Database(dbPath);

// Foreign keys are enabled by initializeSchema() for production and test databases.

export interface SellerSettings {
  id?: number;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  rc: string;
  art: string;
  nif: string;
  nis: string;
  rib: string;
  logo?: string;
}

export interface Client {
  id?: number;
  code: string;
  name: string;
  address: string;
}

export interface Product {
  id?: number;
  name: string;
  description: string;
  unit: string;
  default_price: number;
}

export interface Bill {
  id?: number;
  bill_number: string;
  type: 'facture' | 'proforma' | 'livraison';
  date: string;
  contract_number?: string;
  contract_date?: string;
  client_id?: number;
  client_name_snapshot: string;
  client_address_snapshot: string;
  client_code_snapshot: string;
  tva_rate: number;
  montant_ht: number;
  montant_ttc: number;
  amount_in_words: string;
  notes?: string;
  source_draft_key?: string | null;
  created_at?: string;
}

export interface BillItem {
  id?: number;
  bill_id?: number;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

// Initialize tables if they do not exist. Tests can disable catalog seeds.
export function initializeSchema(database: Database.Database, options: { seed?: boolean } = {}) {
  const seed = options.seed ?? true;
  database.pragma('foreign_keys = ON');

  // 1. Settings Table (strict limit to 1 row via Check constraint)
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      company_name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      rc TEXT NOT NULL,
      art TEXT NOT NULL,
      nif TEXT NOT NULL,
      nis TEXT NOT NULL,
      rib TEXT NOT NULL,
      logo TEXT
    )
  `);

  // 2. Clients Table
  database.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL
    )
  `);

  // 3. Products Table
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      unit TEXT DEFAULT 'UN',
      default_price REAL DEFAULT 0
    )
  `);

  // 4. Bills Table
  database.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      type TEXT CHECK(type IN ('facture', 'proforma', 'livraison')) NOT NULL,
      date TEXT NOT NULL,
      contract_number TEXT,
      contract_date TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name_snapshot TEXT NOT NULL,
      client_address_snapshot TEXT NOT NULL,
      client_code_snapshot TEXT NOT NULL,
      tva_rate REAL DEFAULT 19,
      montant_ht REAL NOT NULL,
      montant_ttc REAL NOT NULL,
      amount_in_words TEXT NOT NULL,
      notes TEXT,
      source_draft_key TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Guarded migrations keep existing billing.db files compatible.
  for (const statement of [
    'ALTER TABLE bills ADD COLUMN notes TEXT',
    'ALTER TABLE bills ADD COLUMN source_draft_key TEXT'
  ]) {
    try {
      database.exec(statement);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('duplicate column name')) throw error;
    }
  }

  // 5. Bill Items Table
  database.exec(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      sort_order INTEGER NOT NULL
    )
  `);

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS bills_source_draft_key_unique
    ON bills(source_draft_key)
    WHERE source_draft_key IS NOT NULL;

    CREATE TABLE IF NOT EXISTS bill_drafts (
      draft_key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision > 0),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!seed) return;

  // Seed default company settings (real TECH IP profile) if empty
  const settingsCount = database.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
  if (settingsCount.count === 0) {
    database.prepare(`
      INSERT INTO settings (id, company_name, address, phone, email, rc, art, nif, nis, rib)
      VALUES (1, 'TECH IP', 'Lotissement souffey N 01 Khemis Miliana', '(+213) 699847473', 'ghebache05110@gmail.com', '44/00-3875390.A.26', '', '15802060020146504400', '795802060020144', '00300281000156530079 BADR Agence khemis-miliana 281 GHEBACHE ABDELKADER')
    `).run();
  }

  // Seed some initial products/clients for testing if empty
  const productsCount = database.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productsCount.count === 0) {
    const productsSeed = [
      { name: 'pointeuse faciale', description: 'pointeuse faciale de marque', unit: 'UN', price: 160000 },
      { name: 'coffret de pointeuse', description: 'coffret de pointeuse de protection', unit: 'UN', price: 19000 },
      { name: 'pHmètre', description: 'pHmètre de laboratoire portatif', unit: 'UN', price: 200000 },
      { name: 'Conductivimètre', description: 'Conductivimètre de table professionnel', unit: 'UN', price: 280000 },
      { name: 'Dessiccateur en verre', description: 'Dessiccateur en verre avec Robinet. Diamètre 300 mm.', unit: 'UN', price: 120000 }
    ];

    const insertProduct = database.prepare(`
      INSERT INTO products (name, description, unit, default_price)
      VALUES (@name, @description, @unit, @price)
    `);

    database.transaction(() => {
      for (const prod of productsSeed) {
        insertProduct.run(prod);
      }
    })();
  }

  const clientsCount = database.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number };
  if (clientsCount.count === 0) {
    database.prepare(`
      INSERT INTO clients (code, name, address)
      VALUES ('C001', 'Faculté des sciences et de technologie', 'Université de Tamenrasset, Tamenrasset, 10000, Algérie')
    `).run();
  }
}

export function initDb() {
  initializeSchema(db);
}

export function getDatabase(): Database.Database {
  return db;
}

// ----------------------------------------------------
// SETTINGS QUERIES
// ----------------------------------------------------

export function getSettings(): SellerSettings {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get() as SellerSettings;
}

export function updateSettings(settings: Omit<SellerSettings, 'id'>) {
  return db.prepare(`
    UPDATE settings
    SET company_name = @company_name,
        address = @address,
        phone = @phone,
        email = @email,
        rc = @rc,
        art = @art,
        nif = @nif,
        nis = @nis,
        rib = @rib,
        logo = @logo
    WHERE id = 1
  `).run(settings);
}

// ----------------------------------------------------
// CLIENTS QUERIES
// ----------------------------------------------------

export function getClients(): Client[] {
  return db.prepare('SELECT * FROM clients ORDER BY name').all() as Client[];
}

export function searchClients(query: string): Client[] {
  return db.prepare(`
    SELECT * FROM clients
    WHERE name LIKE ? OR code LIKE ?
    ORDER BY name
    LIMIT 20
  `).all(`%${query}%`, `%${query}%`) as Client[];
}

export function createClient(client: Omit<Client, 'id'>): { id: number } {
  const existing = db.prepare('SELECT id FROM clients WHERE code = ?').get(client.code) as { id: number } | undefined;
  if (existing) {
    db.prepare(`
      UPDATE clients
      SET name = @name, address = @address
      WHERE id = @id
    `).run({ ...client, id: existing.id });
    return existing;
  } else {
    const info = db.prepare(`
      INSERT INTO clients (code, name, address)
      VALUES (@code, @name, @address)
    `).run(client);
    return { id: info.lastInsertRowid as number };
  }
}

export function updateClient(id: number, client: Omit<Client, 'id'>) {
  return db.prepare(`
    UPDATE clients
    SET code = @code, name = @name, address = @address
    WHERE id = @id
  `).run({ ...client, id });
}

export function deleteClient(id: number) {
  return db.prepare('DELETE FROM clients WHERE id = ?').run(id);
}

// ----------------------------------------------------
// PRODUCTS QUERIES
// ----------------------------------------------------

export function getProducts(): Product[] {
  return db.prepare('SELECT * FROM products ORDER BY name').all() as Product[];
}

export function searchProducts(query: string): Product[] {
  return db.prepare(`
    SELECT * FROM products
    WHERE name LIKE ? OR description LIKE ?
    ORDER BY name
    LIMIT 20
  `).all(`%${query}%`, `%${query}%`) as Product[];
}

export function createProduct(product: Omit<Product, 'id'>): { id: number } {
  const existing = db.prepare('SELECT id FROM products WHERE name = ?').get(product.name) as { id: number } | undefined;
  if (existing) {
    db.prepare(`
      UPDATE products
      SET description = COALESCE(@description, description),
          unit = COALESCE(@unit, unit),
          default_price = @default_price
      WHERE id = @id
    `).run({ ...product, id: existing.id });
    return existing;
  } else {
    const info = db.prepare(`
      INSERT INTO products (name, description, unit, default_price)
      VALUES (@name, @description, @unit, @default_price)
    `).run(product);
    return { id: info.lastInsertRowid as number };
  }
}

export function updateProduct(id: number, product: Omit<Product, 'id'>) {
  return db.prepare(`
    UPDATE products
    SET name = @name, description = @description, unit = @unit, default_price = @default_price
    WHERE id = @id
  `).run({ ...product, id });
}

export function deleteProduct(id: number) {
  return db.prepare('DELETE FROM products WHERE id = ?').run(id);
}

// ----------------------------------------------------
// BILLS QUERIES
// ----------------------------------------------------

export function getBills(): (Bill & { client_name?: string })[] {
  return db.prepare(`
    SELECT b.*, c.name as client_name
    FROM bills b
    LEFT JOIN clients c ON b.client_id = c.id
    ORDER BY b.created_at DESC
  `).all() as (Bill & { client_name?: string })[];
}

export function getBillById(id: number): { bill: Bill; items: BillItem[] } | null {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id) as Bill | undefined;
  if (!bill) return null;
  
  const items = db.prepare(`
    SELECT * FROM bill_items
    WHERE bill_id = ?
    ORDER BY sort_order ASC
  `).all(id) as BillItem[];
  
  return { bill, items };
}

export function getBillByNumber(billNumber: string): { bill: Bill; items: BillItem[] } | null {
  const bill = db.prepare('SELECT * FROM bills WHERE bill_number = ?').get(billNumber) as Bill | undefined;
  if (!bill) return null;
  
  const items = db.prepare(`
    SELECT * FROM bill_items
    WHERE bill_id = ?
    ORDER BY sort_order ASC
  `).all(bill.id) as BillItem[];
  
  return { bill, items };
}

export function getNextBillNumber(type: 'facture' | 'proforma' | 'livraison'): string {
  const prefix = type === 'facture' ? 'F' : type === 'proforma' ? 'P' : 'BL';
  const year = new Date().getFullYear();
  
  // Find the highest number for this year across ALL types
  const row = db.prepare(`
    SELECT bill_number FROM bills
    WHERE bill_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(`${year}-%`) as { bill_number: string } | undefined;
  
  if (row) {
    // Expected format: "2025-0009"
    const parts = row.bill_number.split('-');
    if (parts.length === 2) {
      const currentNum = parseInt(parts[1], 10);
      const nextNum = (currentNum + 1).toString().padStart(4, '0');
      return `${year}-${nextNum}`;
    }
  }
  
  return `${year}-0001`;
}

export function insertFinalBill(
  database: Database.Database,
  bill: Omit<Bill, 'id' | 'created_at'>,
  items: Omit<BillItem, 'id' | 'bill_id'>[]
): { id: number } {
  let clientId = bill.client_id ?? null;
  if (bill.client_code_snapshot) {
    const existing = database.prepare('SELECT id FROM clients WHERE code = ?').get(bill.client_code_snapshot) as { id: number } | undefined;
    if (existing) {
      database.prepare('UPDATE clients SET name = ?, address = ? WHERE id = ?')
        .run(bill.client_name_snapshot, bill.client_address_snapshot, existing.id);
      clientId = existing.id;
    } else {
      const result = database.prepare('INSERT INTO clients (code, name, address) VALUES (?, ?, ?)')
        .run(bill.client_code_snapshot, bill.client_name_snapshot, bill.client_address_snapshot);
      clientId = Number(result.lastInsertRowid);
    }
  }

  const info = database.prepare(`
    INSERT INTO bills (
      bill_number, type, date, contract_number, contract_date, client_id,
      client_name_snapshot, client_address_snapshot, client_code_snapshot,
      tva_rate, montant_ht, montant_ttc, amount_in_words, notes, source_draft_key
    ) VALUES (
      @bill_number, @type, @date, @contract_number, @contract_date, @client_id,
      @client_name_snapshot, @client_address_snapshot, @client_code_snapshot,
      @tva_rate, @montant_ht, @montant_ttc, @amount_in_words, @notes, @source_draft_key
    )
  `).run({
    ...bill,
    client_id: clientId,
    source_draft_key: bill.source_draft_key ?? null,
    notes: bill.notes ?? ''
  });
  const billId = Number(info.lastInsertRowid);

  const insertItem = database.prepare(`
    INSERT INTO bill_items (
      bill_id, product_name, unit, quantity, unit_price, total_price, sort_order
    ) VALUES (
      @bill_id, @product_name, @unit, @quantity, @unit_price, @total_price, @sort_order
    )
  `);

  for (const item of items) {
    if (item.product_name) {
      const existing = database.prepare('SELECT id FROM products WHERE name = ?').get(item.product_name) as { id: number } | undefined;
      if (existing) {
        database.prepare('UPDATE products SET unit = ?, default_price = ? WHERE id = ?')
          .run(item.unit || 'UN', item.unit_price || 0, existing.id);
      } else {
        database.prepare('INSERT INTO products (name, description, unit, default_price) VALUES (?, ?, ?, ?)')
          .run(item.product_name, '', item.unit || 'UN', item.unit_price || 0);
      }
    }
    insertItem.run({ ...item, bill_id: billId });
  }

  return { id: billId };
}

// Create a bill in a transaction, auto-saving new clients/products.
export function createBill(
  bill: Omit<Bill, 'id' | 'created_at'>,
  items: Omit<BillItem, 'id' | 'bill_id'>[]
): { id: number } {
  return db.transaction(() => insertFinalBill(db, bill, items))();
}

// Update a bill in a transaction, deleting old items and adding new ones
export function updateBill(
  id: number,
  bill: Omit<Bill, 'id' | 'created_at'>,
  items: Omit<BillItem, 'id' | 'bill_id'>[]
) {
  const updateBillStmt = db.prepare(`
    UPDATE bills
    SET bill_number = @bill_number,
        type = @type,
        date = @date,
        contract_number = @contract_number,
        contract_date = @contract_date,
        client_id = @client_id,
        client_name_snapshot = @client_name_snapshot,
        client_address_snapshot = @client_address_snapshot,
        client_code_snapshot = @client_code_snapshot,
        tva_rate = @tva_rate,
        montant_ht = @montant_ht,
        montant_ttc = @montant_ttc,
        amount_in_words = @amount_in_words,
        notes = @notes
    WHERE id = @id
  `);

  const deleteItemsStmt = db.prepare('DELETE FROM bill_items WHERE bill_id = ?');

  const insertItem = db.prepare(`
    INSERT INTO bill_items (
      bill_id, product_name, unit, quantity, unit_price, total_price, sort_order
    ) VALUES (
      @bill_id, @product_name, @unit, @quantity, @unit_price, @total_price, @sort_order
    )
  `);

  db.transaction(() => {
    // 1. If client is updated/new, auto-save to catalog
    let clientId = bill.client_id;
    if (bill.client_code_snapshot) {
      const clientResult = createClient({
        code: bill.client_code_snapshot,
        name: bill.client_name_snapshot,
        address: bill.client_address_snapshot
      });
      clientId = clientResult.id;
    }

    // 2. Update the main bill
    updateBillStmt.run({
      ...bill,
      client_id: clientId,
      id
    });

    // 3. Delete old items
    deleteItemsStmt.run(id);

    // 4. Insert new items and auto-save products to catalog
    for (const item of items) {
      if (item.product_name) {
        createProduct({
          name: item.product_name,
          description: '',
          unit: item.unit || 'UN',
          default_price: item.unit_price || 0
        });
      }

      insertItem.run({
        ...item,
        bill_id: id
      });
    }
  })();
}

export function deleteBill(id: number) {
  return db.prepare('DELETE FROM bills WHERE id = ?').run(id);
}

// Call initDb upon file load to verify schema is ready
initDb();
