// backend/src/db/database.ts
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { logger } from '../utils/logger';

export class Database {
  private db: sqlite3.Database | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database('data/grid_bot.db', (err) => {
        if (err) {
          logger.error('Error abriendo DB:', err);
          reject(err);
        } else {
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  private async createTables(): Promise<void> {
    const run = promisify(this.db!.run.bind(this.db));

    await run(`
      CREATE TABLE IF NOT EXISTS grids (
        id TEXT PRIMARY KEY,
        instrument TEXT NOT NULL,
        rangelow REAL NOT NULL,
        rangeHigh REAL NOT NULL,
        levels INTEGER NOT NULL,
        amountPerLevel REAL NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        gridId TEXT,
        instrument TEXT,
        side TEXT,
        price REAL,
        quantity REAL,
        status TEXT,
        timestamp DATETIME,
        FOREIGN KEY(gridId) REFERENCES grids(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS fills (
        id TEXT PRIMARY KEY,
        orderId TEXT,
        gridId TEXT,
        instrument TEXT,
        side TEXT,
        price REAL,
        quantity REAL,
        timestamp DATETIME,
        pnl REAL,
        FOREIGN KEY(orderId) REFERENCES orders(id),
        FOREIGN KEY(gridId) REFERENCES grids(id)
      )
    `);

    logger.info('✅ Tablas creadas/verificadas');
  }

  async getGrids(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db!.all('SELECT * FROM grids', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async createGrid(grid: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const { id, instrument, rangelow, rangeHigh, levels, amountPerLevel, enabled } = grid;
      this.db!.run(
        `INSERT INTO grids VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, instrument, rangelow, rangeHigh, levels, amountPerLevel, enabled ? 1 : 0],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async deleteGrid(gridId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM grids WHERE id = ?', [gridId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async saveFill(fill: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const { id, orderId, gridId, instrument, side, price, quantity, timestamp, pnl } = fill;
      this.db!.run(
        `INSERT INTO fills VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, orderId, gridId, instrument, side, price, quantity, timestamp, pnl],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getFills(gridId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db!.all('SELECT * FROM fills WHERE gridId = ? ORDER BY timestamp DESC', [gridId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
