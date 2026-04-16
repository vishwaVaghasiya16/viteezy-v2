/**
 * Application configuration — single entry. Env is loaded via bootstrapEnv + Zod in envSchema.
 * @module config
 */
import "./bootstrapEnv";
import { loadConfig, type AppConfig } from "./envSchema";

export const config: AppConfig = loadConfig();

export type { AppConfig };

export const isProduction = (): boolean => {
  return config.server.nodeEnv === "production";
};

export const isDevelopment = (): boolean => {
  return config.server.nodeEnv === "development";
};

export const isTest = (): boolean => {
  return config.server.nodeEnv === "test";
};

export { normalizeEnvString, envSchema, parseProcessEnv, buildAppConfig } from "./envSchema";
