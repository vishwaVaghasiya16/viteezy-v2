import fs from "fs";
import path from "path";
import { logger } from "./logger";

/**
 * Parse CSV file and return array of objects
 */
export function parseCSV(filePath: string): Record<string, string>[] {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent.split("\n").filter((line) => line.trim() !== "");

    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }

    // Parse header
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""));

    // Parse data rows
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        logger.warn(`Skipping row ${i + 1}: column count mismatch`);
        continue;
      }

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim().replace(/^"|"$/g, "") || "";
      });
      data.push(row);
    }

    return data;
  } catch (error: any) {
    logger.error(`Error parsing CSV file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  values.push(current);

  return values;
}

/**
 * Download CSV from URL and save to file
 */
export async function downloadCSV(
  url: string,
  outputPath: string
): Promise<void> {
  try {
    const fetch = (await import("node-fetch")).default;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.statusText}`);
    }

    const text = await response.text();
    fs.writeFileSync(outputPath, text, "utf-8");
    logger.info(`CSV downloaded and saved to ${outputPath}`);
  } catch (error: any) {
    logger.error(`Error downloading CSV from ${url}:`, error);
    throw error;
  }
}
