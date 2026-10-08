import "dotenv/config";
import { defineConfig } from "drizzle-kit";
export default defineConfig({
 dialect: "mysql", schema: "./src/db/schema.ts",
 dbCredentials: { host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "app_db", ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined },
});
