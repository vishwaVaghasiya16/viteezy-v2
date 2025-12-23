import mongoose from "mongoose";
import { connectDatabase } from "@/config/database";
import { Countries } from "@/models/core/countries.model";
import { parseCSV, downloadCSV } from "@/utils/csvParser";
import { logger } from "@/utils/logger";
import fs from "fs";
import path from "path";

const CSV_FILE_PATH = path.join(__dirname, "../../data/countries.csv");

interface CountryCSVRow {
  name: string;
  "alpha-2": string;
  "country-code": string;
}

/**
 * Ensure CSV file exists
 */
async function ensureCSVFile(): Promise<void> {
  const dataDir = path.dirname(CSV_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(
      `Countries CSV file not found at ${CSV_FILE_PATH}. Please ensure the file exists.`
    );
  }

  logger.info(`Using countries CSV file: ${CSV_FILE_PATH}`);
}

/**
 * Seed countries from CSV
 */
export async function seedCountries(): Promise<void> {
  try {
    logger.info("🌍 Starting countries seeding...");

    // Ensure CSV file exists
    await ensureCSVFile();

    // Parse CSV
    const rows = parseCSV(CSV_FILE_PATH) as unknown as CountryCSVRow[];

    logger.info(`Found ${rows.length} countries in CSV`);

    // Transform and insert countries
    const countries = rows
      .filter((row) => row.name && row["alpha-2"] && row["country-code"]) // Filter out invalid rows
      .map((row) => {
        // Pad numeric code with leading zeros if needed (ensure 3 digits)
        const numericCode = String(row["country-code"]).padStart(3, "0");

        // Build country object without undefined fields to avoid sparse index conflicts
        const country: any = {
          name: row.name.trim(),
          alpha2: row["alpha-2"].trim().toUpperCase(),
          numeric: numericCode,
          isActive: true,
          createdBy: new mongoose.Types.ObjectId(),
          updatedBy: new mongoose.Types.ObjectId(),
        };

        // Only include optional fields if they have values
        // Note: alpha3, region, subRegion are not in CSV, so we don't include them

        return country;
      });

    // Drop existing alpha3 unique index if it exists (to allow multiple nulls)
    try {
      await Countries.collection.dropIndex("alpha3_1");
      logger.info("Dropped existing alpha3_1 index");
    } catch (error: any) {
      if (error.code !== 27) {
        // 27 = IndexNotFound
        logger.warn("Could not drop alpha3_1 index:", error.message);
      }
    }

    // Clear existing countries (optional - comment out if you want to keep existing)
    const deleteResult = await Countries.deleteMany({});
    logger.info(`Deleted ${deleteResult.deletedCount} existing countries`);

    // Insert countries
    const result = await Countries.insertMany(countries, {
      ordered: false, // Continue on duplicate key errors
    });

    logger.info(`✅ Successfully seeded ${result.length} countries`);

    // Log summary
    const totalCount = await Countries.countDocuments({ isDeleted: false });
    logger.info(`Total countries in database: ${totalCount}`);

    // Log sample countries
    const sampleCountries = await Countries.find({ isDeleted: false })
      .select("name alpha2 numeric")
      .limit(10)
      .sort({ name: 1 })
      .lean();

    logger.info("Sample countries:");
    sampleCountries.forEach((country) => {
      logger.info(`  ${country.name} (${country.alpha2}) - ${country.numeric}`);
    });
  } catch (error: any) {
    logger.error("❌ Error seeding countries:", error);
    throw error;
  }
}

/**
 * Run seeder (for CLI usage)
 */
async function runSeeder() {
  try {
    console.log("Connecting to database...");
    await connectDatabase();
    console.log("Database connected, starting seeding...");
    await seedCountries();
    await mongoose.connection.close();
    console.log("✅ Seeder completed successfully");
    logger.info("✅ Seeder completed successfully");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Seeder failed:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    logger.error("❌ Seeder failed:", error);
    if (error.stack) {
      logger.error("Stack trace:", error.stack);
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSeeder().catch((error) => {
    console.error("Unhandled seeder error:", error);
    process.exit(1);
  });
}
