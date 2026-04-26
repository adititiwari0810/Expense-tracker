/**
 * SQLite database initialization and migration.
 *
 * Uses better-sqlite3 for synchronous, transactional access.
 * The UNIQUE constraint on idempotency_key is the core mechanism
 * for preventing duplicate expense records.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'expenses.db');

let db;

function getDb() {
  if (!db) {
    const dbDir = path.dirname(DB_PATH);
    fs.mkdirSync(dbDir, { recursive: true });

    db = new Database(DB_PATH);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    // Enforce foreign keys
    db.pragma('foreign_keys = ON');

    runMigrations(db);
    logger.info('Database initialized', { path: DB_PATH });
  }
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT    NOT NULL UNIQUE,
      amount          INTEGER NOT NULL CHECK(amount > 0),
      category        TEXT    NOT NULL,
      description     TEXT    NOT NULL DEFAULT '',
      date            TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_idempotency ON expenses(idempotency_key);
  `);
  logger.info('Database migrations complete');
}

function closeDb() {
  if (db) {
    db.close();
    db = undefined;
    logger.info('Database connection closed');
  }
}

module.exports = { getDb, closeDb };