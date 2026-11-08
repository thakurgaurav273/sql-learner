// Folder for your own data (saved queries, settings). Not part of the project; git-ignored.
// Set SQLPG_DATA_DIR to keep it somewhere else.
import { fileURLToPath } from 'node:url';

export const dataDir = process.env.SQLPG_DATA_DIR || fileURLToPath(new URL('../data', import.meta.url));
