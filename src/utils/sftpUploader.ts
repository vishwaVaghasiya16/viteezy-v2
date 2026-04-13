import * as fs from "fs";
import * as path from "path";
import { Client, ConnectConfig } from "ssh2";
import { logger } from "./logger";
import { config as appConfig } from "@/config";

/**
 * SFTP Uploader Utility
 * Uploads files to PostNL SFTP server
 */

interface SFTPConfig {
  host: string;
  username: string;
  privateKeyPath?: string;
  privateKey?: string | Buffer;
  port?: number;
  passphrase?: string;
  algorithms?: { serverHostKey?: string[] };
}

/**
 * Load SFTP config with resolved key path and key as string (avoids encoding issues).
 * Throws if key is not configured or file missing.
 */
function getSFTPConfig(): SFTPConfig {
  const sftpOptions: SFTPConfig = {
    host: appConfig.sftp.host,
    username: appConfig.sftp.username,
    port: appConfig.sftp.port,
    // Prefer newer RSA algorithms (many gateways e.g. IBM Sterling disable legacy ssh-rsa)
    algorithms: {
      serverHostKey: ["rsa-sha2-512", "rsa-sha2-256", "ssh-rsa"],
    },
  };

  const privateKeyPath = appConfig.sftp.privateKeyFilename;
  if (privateKeyPath) {
    const resolvedPath = path.isAbsolute(privateKeyPath)
      ? privateKeyPath
      : path.resolve(process.cwd(), privateKeyPath);
    if (fs.existsSync(resolvedPath)) {
      const raw = fs.readFileSync(resolvedPath);
      sftpOptions.privateKey = (typeof raw === "string" ? raw : raw.toString("utf8")).trim();
      return sftpOptions;
    }
  }
  if (appConfig.sftp.privateKey) {
    sftpOptions.privateKey = appConfig.sftp.privateKey.trim();
    return sftpOptions;
  }
  throw new Error("SFTP private key not configured (set SFTP_PRIVATEKEY_FILENAME or SFTP_PRIVATE_KEY)");
}

/**
 * Returns safe diagnostics about the configured SFTP key (for debugging auth failures).
 * Does not expose key content.
 */
export function getSFTPKeyDiagnostics(): {
  keyConfigured: boolean;
  keyPathResolved?: string;
  keyPathExists: boolean;
  keyFormatValid: boolean;
  host: string;
  username: string;
} {
  const host = appConfig.sftp.host;
  const username = appConfig.sftp.username;
  const privateKeyPath = appConfig.sftp.privateKeyFilename;
  const fromEnv = !!appConfig.sftp.privateKey;

  if (fromEnv) {
    const raw = appConfig.sftp.privateKey || "";
    const valid = raw.includes("-----BEGIN") && raw.includes("-----END");
    return {
      keyConfigured: true,
      keyPathExists: true,
      keyFormatValid: valid,
      host,
      username,
    };
  }

  if (!privateKeyPath) {
    return { keyConfigured: false, keyPathExists: false, keyFormatValid: false, host, username };
  }

  const resolvedPath = path.isAbsolute(privateKeyPath)
    ? privateKeyPath
    : path.resolve(process.cwd(), privateKeyPath);
  const exists = fs.existsSync(resolvedPath);
  let keyFormatValid = false;
  if (exists) {
    try {
      const raw = fs.readFileSync(resolvedPath, "utf8").trim();
      keyFormatValid =
        (raw.startsWith("-----BEGIN RSA PRIVATE KEY-----") ||
          raw.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----")) &&
        raw.includes("-----END");
    } catch {
      keyFormatValid = false;
    }
  }

  return {
    keyConfigured: !!privateKeyPath,
    keyPathResolved: resolvedPath,
    keyPathExists: exists,
    keyFormatValid,
    host,
    username,
  };
}

/**
 * Upload file to SFTP server
 */
export async function uploadToSFTP(
  localFilePath: string,
  remotePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sftpOptions = getSFTPConfig();
    const conn = new Client();

    conn
      .on("ready", () => {
        logger.info("SFTP connection established");

        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          // Ensure remote directory exists
          const remoteDir = remotePath.substring(0, remotePath.lastIndexOf("/"));
          sftp.mkdir(remoteDir, { mode: 0o755 }, (mkdirErr: any) => {
            // Ignore error if directory already exists
            // SFTP error codes: 4 = SSH2_FX_FAILURE (often means dir exists)
            if (mkdirErr) {
              const errorCode = (mkdirErr as any).code;
              if (errorCode !== 4 && errorCode !== undefined) {
                logger.warn(`Failed to create remote directory: ${mkdirErr.message}`, {
                  code: errorCode,
                });
              }
              // If code is 4 or undefined, directory likely already exists - continue
            }

            // Upload file
            sftp.fastPut(localFilePath, remotePath, (putErr) => {
              conn.end();

              if (putErr) {
                logger.error(`SFTP upload failed: ${putErr.message}`);
                reject(putErr);
                return;
              }

              logger.info(`File uploaded successfully: ${remotePath}`);
              resolve();
            });
          });
        });
      })
      .on("error", (err) => {
        logger.error(`SFTP connection error: ${err.message}`);
        reject(err);
      })
      .connect(sftpOptions as ConnectConfig);
  });
}

/**
 * Download file from SFTP server
 */
export async function downloadFromSFTP(
  remotePath: string,
  localFilePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sftpOptions = getSFTPConfig();
    const conn = new Client();

    conn
      .on("ready", () => {
        logger.info("SFTP connection established for download");

        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          // Download file
          sftp.fastGet(remotePath, localFilePath, (getErr) => {
            conn.end();

            if (getErr) {
              logger.error(`SFTP download failed: ${getErr.message}`);
              reject(getErr);
              return;
            }

            logger.info(`File downloaded successfully: ${localFilePath}`);
            resolve();
          });
        });
      })
      .on("error", (err) => {
        logger.error(`SFTP connection error: ${err.message}`);
        reject(err);
      })
      .connect(sftpOptions as ConnectConfig);
  });
}

/**
 * List files in SFTP directory
 */
export async function listSFTPFiles(remoteDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const sftpOptions = getSFTPConfig();
    const conn = new Client();

    conn
      .on("ready", () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          sftp.readdir(remoteDir, (readErr, list) => {
            conn.end();

            if (readErr) {
              logger.error(`SFTP list failed: ${readErr.message}`);
              reject(readErr);
              return;
            }

            const files = list
              .filter((item) => item.attrs.isFile())
              .map((item) => item.filename);
            resolve(files);
          });
        });
      })
      .on("error", (err) => {
        logger.error(`SFTP connection error: ${err.message}`);
        reject(err);
      })
      .connect(sftpOptions as ConnectConfig);
  });
}
