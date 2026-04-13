/**
 * Must be imported before any module that reads process.env for app configuration.
 * ESM hoists bare imports, so this file is imported first from config/index.ts.
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
