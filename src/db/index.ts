import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const {
  DB_HOST = "127.0.0.1",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD,
  DB_NAME = "app_db",
} = process.env;


const globalForDb = globalThis as typeof globalThis & {
  __nexusMysqlPool?: mysql.Pool;
};

export const pool =
  globalForDb.__nexusMysqlPool ??
  mysql.createPool({
    host: DB_HOST,
    port: parseInt(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD || "",
    database: DB_NAME,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__nexusMysqlPool = pool;
}

export const db = drizzle(pool);
