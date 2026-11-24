import fs from "fs";
import path from "path";
import type { AakashNetworkConfig, NetworkMode } from "./types";
import { getPrimaryLanIp, getDetectedTailscaleIp } from "../lan-detector";
import { logger } from "../logger";

export interface INetworkConfigRepository {
  get(): AakashNetworkConfig;
  save(config: Omit<AakashNetworkConfig, "updatedAt">): AakashNetworkConfig;
  reset(): AakashNetworkConfig;
  isLocked(): boolean;
}

export class JsonFileConfigRepository implements INetworkConfigRepository {
  private filePath: string;
  private inMemoryCache: AakashNetworkConfig | null = null;

  constructor(customPath?: string) {
    const rawPath =
      customPath ||
      process.env.AAKASH_CONFIG_STORAGE_PATH ||
      path.join(process.cwd(), "data", "aakash-ui-config.json");
    this.filePath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
  }

  public isLocked(): boolean {
    const lockedEnv = process.env.AAKASH_CONFIG_LOCKED;
    return lockedEnv === "true" || lockedEnv === "1";
  }

  public getDefaultConfig(): AakashNetworkConfig {
    const envMode = (process.env.AAKASH_NETWORK_MODE as NetworkMode) || "local";
    const defaultHostForMode =
      envMode === "local"
        ? "localhost"
        : envMode === "lan"
        ? getPrimaryLanIp()
        : envMode === "tailscale"
        ? (getDetectedTailscaleIp() || "100.64.0.10")
        : "aakash.dev.internal";
    const envHost = process.env.AAKASH_PUBLIC_HOST || defaultHostForMode;
    const envProtocol = (process.env.AAKASH_PUBLIC_PROTOCOL as "http" | "https") || "http";
    const envPort = process.env.AAKASH_API_PORT ? parseInt(process.env.AAKASH_API_PORT, 10) : 4566;

    return {
      mode: ["local", "lan", "tailscale", "custom"].includes(envMode) ? envMode : "local",
      protocol: envProtocol === "https" ? "https" : "http",
      host: envHost,
      apiPort: Number.isInteger(envPort) && envPort > 0 && envPort <= 65535 ? envPort : 4566,
      updatedAt: new Date().toISOString(),
    };
  }

  public get(): AakashNetworkConfig {
    if (this.inMemoryCache) {
      return this.inMemoryCache;
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (parsed && typeof parsed === "object" && parsed.mode && parsed.host) {
          const config: AakashNetworkConfig = {
            mode: parsed.mode,
            protocol: parsed.protocol === "https" ? "https" : "http",
            host: String(parsed.host),
            apiPort: Number(parsed.apiPort) || 4566,
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
          this.inMemoryCache = config;
          return config;
        }
      }
    } catch (err) {
      logger.warn({ err, path: this.filePath }, "Failed to read network configuration file, falling back to defaults.");
    }

    return this.getDefaultConfig();
  }

  private writeConfigFile(data: AakashNetworkConfig): void {
    this.inMemoryCache = data;

    const dir = path.dirname(this.filePath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = JSON.stringify(data, null, 2);

      try {
        const tempFile = path.join(dir, `aakash-config-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
        fs.writeFileSync(tempFile, content, "utf-8");
        fs.renameSync(tempFile, this.filePath);
      } catch {
        fs.writeFileSync(this.filePath, content, "utf-8");
      }
    } catch (err) {
      logger.warn({ err, path: this.filePath }, "Persistent write to file failed; stored in-memory.");
    }
  }

  public save(config: Omit<AakashNetworkConfig, "updatedAt">): AakashNetworkConfig {
    if (this.isLocked()) {
      throw new Error("Configuration is locked by the server administrator (AAKASH_CONFIG_LOCKED=true).");
    }

    const newConfig: AakashNetworkConfig = {
      mode: config.mode,
      protocol: config.protocol,
      host: config.host.trim(),
      apiPort: config.apiPort || 4566,
      updatedAt: new Date().toISOString(),
    };

    this.writeConfigFile(newConfig);
    logger.info({ newConfig }, "Aakash network configuration updated.");
    return newConfig;
  }

  public reset(): AakashNetworkConfig {
    if (this.isLocked()) {
      throw new Error("Configuration is locked by the server administrator (AAKASH_CONFIG_LOCKED=true).");
    }

    const defaultConfig: AakashNetworkConfig = {
      mode: "local",
      protocol: "http",
      host: "localhost",
      apiPort: 4566,
      updatedAt: new Date().toISOString(),
    };

    this.writeConfigFile(defaultConfig);
    return defaultConfig;
  }
}

export const networkConfigRepo = new JsonFileConfigRepository();
