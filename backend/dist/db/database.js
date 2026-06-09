"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
// backend/src/db/database.ts
const sqlite3_1 = __importDefault(require("sqlite3"));
const util_1 = require("util");
const logger_1 = require("../utils/logger");
class Database {
    db = null;
    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3_1.default.Database('data/grid_bot.db', (err) => {
                if (err) {
                    logger_1.logger.error('Error abriendo DB:', err);
                    reject(err);
                }
                else {
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }
    async createTables() {
        const run = (0, util_1.promisify)(this.db.run.bind(this.db));
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
        logger_1.logger.info('✅ Tablas creadas/verificadas');
    }
    async getGrids() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM grids', (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    async createGrid(grid) {
        return new Promise((resolve, reject) => {
            const { id, instrument, rangelow, rangeHigh, levels, amountPerLevel, enabled } = grid;
            this.db.run(`INSERT INTO grids VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [id, instrument, rangelow, rangeHigh, levels, amountPerLevel, enabled ? 1 : 0], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async deleteGrid(gridId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM grids WHERE id = ?', [gridId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async saveFill(fill) {
        return new Promise((resolve, reject) => {
            const { id, orderId, gridId, instrument, side, price, quantity, timestamp, pnl } = fill;
            this.db.run(`INSERT INTO fills VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, orderId, gridId, instrument, side, price, quantity, timestamp, pnl], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async getFills(gridId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM fills WHERE gridId = ? ORDER BY timestamp DESC', [gridId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
}
exports.Database = Database;
