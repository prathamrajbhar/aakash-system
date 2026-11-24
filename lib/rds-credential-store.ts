import fs from "fs";
import path from "path";
import { logger } from "./logger";

const CREDENTIALS_FILE = path.join(process.cwd(), "data", "rds-credentials.json");

function readAll(): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn({ err }, "Could not read RDS credential store; treating it as empty.");
    }
    return {};
  }
}

/** Atomic write (temp file + rename) so a crash never leaves a half-written file. */
function writeAll(data: Record<string, string>): void {
  fs.mkdirSync(path.dirname(CREDENTIALS_FILE), { recursive: true });
  const tmp = `${CREDENTIALS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
  fs.renameSync(tmp, CREDENTIALS_FILE);
}

/** Stored master password for an instance, or "postgres" if none was saved. */
export function getRdsPassword(identifier: string): string {
  const value = readAll()[identifier];
  return value ? String(value) : "postgres";
}

/** Persists the master password. Failures are logged, never thrown. */
export function saveRdsPassword(identifier: string, password: string): void {
  try {
    writeAll({ ...readAll(), [identifier]: password });
  } catch (err) {
    logger.error({ err, identifier }, "Failed to save RDS master password; the console will show the default.");
  }
}

export function deleteRdsPassword(identifier: string): void {
  try {
    const data = readAll();
    if (identifier in data) {
      delete data[identifier];
      writeAll(data);
    }
  } catch (err) {
    logger.error({ err, identifier }, "Failed to remove stored RDS password.");
  }
}
