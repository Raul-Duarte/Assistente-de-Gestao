import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { appConfig } from "./config";

const { Pool } = pg;

export const pool = new Pool({ connectionString: appConfig.databaseUrl });
export const db = drizzle(pool, { schema });
