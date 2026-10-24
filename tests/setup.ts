import os from "node:os";
import path from "node:path";
import "@testing-library/jest-dom";

// Keep tests from mutating the real persisted network configuration.
process.env.AAKASH_CONFIG_STORAGE_PATH = path.join(
  os.tmpdir(),
  `aakash-test-config-${process.pid}.json`
);
process.env.AAKASH_CONFIG_LOCKED = "false";
