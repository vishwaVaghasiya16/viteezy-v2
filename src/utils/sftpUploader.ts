import * as fs from "fs";
import { Client } from "ssh2";
import { logger } from "./logger";

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
}

/**
 * Upload file to SFTP server
 */
export async function uploadToSFTP(
  localFilePath: string,
  remotePath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const config: SFTPConfig = {
      host: process.env.SFTP_REMOTE_HOST || "sftp-gateway-transfer.a16.cldsvc.net",
      username: process.env.SFTP_USERNAME || "sftpviteezya",
      port: parseInt(process.env.SFTP_PORT || "22"),
    };

    // Load private key
    const privateKeyPath = process.env.SFTP_PRIVATEKEY_FILENAME;
    if (privateKeyPath && fs.existsSync(privateKeyPath)) {
      config.privateKey = fs.readFileSync(privateKeyPath);
    } else if (process.env.SFTP_PRIVATE_KEY) {
      config.privateKey = process.env.SFTP_PRIVATE_KEY;
    } else {
      reject(new Error("SFTP private key not configured"));
      return;
    }

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
      .connect(config);
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
    const config: SFTPConfig = {
      host: process.env.SFTP_REMOTE_HOST || "sftp-gateway-transfer.a16.cldsvc.net",
      username: process.env.SFTP_USERNAME || "sftpviteezya",
      port: parseInt(process.env.SFTP_PORT || "22"),
    };

    // Load private key
    const privateKeyPath = process.env.SFTP_PRIVATEKEY_FILENAME;
    if (privateKeyPath && fs.existsSync(privateKeyPath)) {
      config.privateKey = fs.readFileSync(privateKeyPath);
    } else if (process.env.SFTP_PRIVATE_KEY) {
      config.privateKey = process.env.SFTP_PRIVATE_KEY;
    } else {
      reject(new Error("SFTP private key not configured"));
      return;
    }

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
      .connect(config);
  });
}

/**
 * List files in SFTP directory
 */
export async function listSFTPFiles(remoteDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const config: SFTPConfig = {
      host: process.env.SFTP_REMOTE_HOST || "sftp-gateway-transfer.a16.cldsvc.net",
      username: process.env.SFTP_USERNAME || "sftpviteezya",
      port: parseInt(process.env.SFTP_PORT || "22"),
    };

    // Load private key
    const privateKeyPath = process.env.SFTP_PRIVATEKEY_FILENAME;
    if (privateKeyPath && fs.existsSync(privateKeyPath)) {
      config.privateKey = fs.readFileSync(privateKeyPath);
    } else if (process.env.SFTP_PRIVATE_KEY) {
      config.privateKey = process.env.SFTP_PRIVATE_KEY;
    } else {
      reject(new Error("SFTP private key not configured"));
      return;
    }

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
      .connect(config);
  });
}
