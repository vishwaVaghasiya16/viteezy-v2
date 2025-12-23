import mongoose from "mongoose";
import { connectDatabase } from "@/config/database";
import { Countries } from "@/models/core/countries.model";
import { States } from "@/models/core/states.model";
import { logger } from "@/utils/logger";
import fs from "fs";
import path from "path";

const JSON_FILE_PATH = path.join(__dirname, "../../data/countries-states.json");

interface CountryStatesData {
  name: string;
  states: string[];
}

/**
 * Generate state code from state name
 * Rules:
 * - Take first 2-3 uppercase letters
 * - Remove spaces and special characters
 * - For long names, use abbreviation logic
 */
function generateStateCode(stateName: string, countryCode: string): string {
  // Remove extra spaces and trim
  const cleaned = stateName.trim().replace(/\s+/g, " ");

  // Common abbreviations for known countries
  const abbreviations: Record<string, Record<string, string>> = {
    US: {
      "District of Columbia": "DC",
      "New Hampshire": "NH",
      "New Jersey": "NJ",
      "New Mexico": "NM",
      "New York": "NY",
      "North Carolina": "NC",
      "North Dakota": "ND",
      "Rhode Island": "RI",
      "South Carolina": "SC",
      "South Dakota": "SD",
      "West Virginia": "WV",
    },
  };

  // Check if there's a known abbreviation
  if (abbreviations[countryCode]?.[cleaned]) {
    return abbreviations[countryCode][cleaned];
  }

  // For short names (<= 3 words), use first letters of each word
  const words = cleaned.split(" ");
  if (words.length <= 3 && words.length > 1) {
    return words
      .map((word) => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 3);
  }

  // For single word or long names, use first 2-3 characters
  // Remove common prefixes/suffixes
  let code = cleaned
    .replace(/^(The|La|Le|Les|El|Los|Las|De|Van|Von|Der|Die|Das)\s+/i, "")
    .replace(/\s+(Province|State|Region|Territory|Island|Islands)$/i, "");

  // Take first 2-3 uppercase letters
  const upperChars = code.replace(/[^A-Z]/g, "");
  if (upperChars.length >= 2) {
    return upperChars.substring(0, Math.min(3, upperChars.length));
  }

  // Fallback: use first 2-3 characters of the cleaned name
  return code
    .replace(/[^A-Za-z]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(2, "X");
}

/**
 * Load countries and states from JSON file
 */
function loadCountriesStatesFromFile(): CountryStatesData[] {
  if (!fs.existsSync(JSON_FILE_PATH)) {
    throw new Error(
      `Countries-states JSON file not found at ${JSON_FILE_PATH}. Please ensure the file exists.`
    );
  }

  try {
    const fileContent = fs.readFileSync(JSON_FILE_PATH, "utf-8");
    const data = JSON.parse(fileContent) as CountryStatesData[];
    logger.info(`Loaded countries-states data from ${JSON_FILE_PATH}`);
    return data;
  } catch (error: any) {
    logger.error(`Failed to load countries-states from JSON file: ${error}`);
    throw error;
  }
}

/**
 * Seed states from countries-states JSON file
 */
export async function seedStates(): Promise<void> {
  try {
    logger.info("🗺️  Starting states seeding from countries-states.json...");

    // Load countries-states data
    const countriesStatesData = loadCountriesStatesFromFile();
    logger.info(`Found ${countriesStatesData.length} countries in JSON`);

    // Get all countries for mapping (by name and alpha2)
    const countries = await Countries.find({ isActive: true }).lean();
    const countryMapByName = new Map(
      countries.map((c) => [c.name.toLowerCase().trim(), c])
    );
    const countryMapByCode = new Map(
      countries.map((c) => [c.alpha2.toUpperCase(), c])
    );

    let totalInserted = 0;
    let totalSkipped = 0;
    let countriesProcessed = 0;
    let countriesNotFound = 0;

    // Process each country's states
    for (const countryData of countriesStatesData) {
      const countryName = countryData.name.trim();
      const countryKey = countryName.toLowerCase();

      // Try to find country by name (case-insensitive)
      let country = countryMapByName.get(countryKey);

      // If not found, try partial match
      if (!country) {
        for (const [name, c] of countryMapByName.entries()) {
          if (
            name.includes(countryKey) ||
            countryKey.includes(name) ||
            c.name.toLowerCase() === countryKey
          ) {
            country = c;
            break;
          }
        }
      }

      if (!country) {
        logger.warn(
          `Country "${countryName}" not found in database, skipping ${countryData.states.length} states`
        );
        countriesNotFound++;
        totalSkipped += countryData.states.length;
        continue;
      }

      const countryCode = country.alpha2.toUpperCase();
      const countryId = country._id.toString();

      // Skip if no states
      if (!countryData.states || countryData.states.length === 0) {
        logger.info(`No states for ${countryName} (${countryCode}), skipping`);
        continue;
      }

      // Clear existing states for this country (optional)
      const deleteResult = await States.deleteMany({
        countryCode: countryCode,
      });
      if (deleteResult.deletedCount > 0) {
        logger.info(
          `Deleted ${deleteResult.deletedCount} existing states for ${countryName} (${countryCode})`
        );
      }

      // Prepare states for insertion
      const statesToInsert = countryData.states
        .filter((stateName) => stateName && stateName.trim().length > 0)
        .map((stateName, index) => {
          const cleanedName = stateName.trim();
          const stateCode = generateStateCode(cleanedName, countryCode);

          return {
            name: cleanedName,
            code: stateCode,
            countryId: new mongoose.Types.ObjectId(countryId),
            countryCode: countryCode,
            type: "state", // Default type
            isActive: true,
            createdBy: new mongoose.Types.ObjectId(),
            updatedBy: new mongoose.Types.ObjectId(),
          };
        });

      // Remove duplicates based on code
      const uniqueStates = new Map<string, (typeof statesToInsert)[0]>();
      for (const state of statesToInsert) {
        const key = `${state.countryCode}-${state.code}`;
        if (!uniqueStates.has(key)) {
          uniqueStates.set(key, state);
        } else {
          // If duplicate code, append number
          let counter = 1;
          let newKey = `${state.countryCode}-${state.code}${counter}`;
          while (uniqueStates.has(newKey)) {
            counter++;
            newKey = `${state.countryCode}-${state.code}${counter}`;
          }
          state.code = `${state.code}${counter}`;
          uniqueStates.set(newKey, state);
        }
      }

      const finalStates = Array.from(uniqueStates.values());

      try {
        const result = await States.insertMany(finalStates, {
          ordered: false, // Continue on duplicate key errors
        });
        totalInserted += result.length;
        countriesProcessed++;
        logger.info(
          `✅ Inserted ${result.length} states for ${countryName} (${countryCode})`
        );
      } catch (error: any) {
        if (error.code === 11000) {
          // Duplicate key error - some states already exist
          const inserted = error.writeErrors
            ? finalStates.length - error.writeErrors.length
            : 0;
          totalInserted += inserted;
          countriesProcessed++;
          logger.warn(
            `Some states for ${countryName} (${countryCode}) already exist. Inserted ${inserted} new states.`
          );
        } else {
          logger.error(
            `Error inserting states for ${countryName} (${countryCode}):`,
            error.message
          );
          throw error;
        }
      }
    }

    logger.info(`✅ Successfully seeded ${totalInserted} states`);
    logger.info(`📊 Processed ${countriesProcessed} countries`);
    if (countriesNotFound > 0) {
      logger.warn(`⚠️  ${countriesNotFound} countries not found in database`);
    }
    if (totalSkipped > 0) {
      logger.warn(`⚠️  Skipped ${totalSkipped} states (country not found)`);
    }

    // Log summary
    const totalStates = await States.countDocuments({ isDeleted: false });
    const countryCounts = await States.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$countryCode", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    logger.info(`Total states in database: ${totalStates}`);
    logger.info("Top 10 countries by state count:");
    countryCounts.forEach((country) => {
      logger.info(`  ${country._id}: ${country.count} states`);
    });
  } catch (error: any) {
    logger.error("❌ Error seeding states:", error);
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
    await seedStates();
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
