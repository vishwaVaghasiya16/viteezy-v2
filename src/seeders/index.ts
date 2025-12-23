import { seedCountries } from "./countrySeeder";
import { seedStates } from "./stateSeeder";
import { logger } from "@/utils/logger";
import { connectDatabase } from "@/config/database";

/**
 * Run all seeders
 */
export async function runAllSeeders(): Promise<void> {
  try {
    logger.info("🌱 Starting database seeding...");

    await connectDatabase();

    // Seed countries first (states depend on countries)
    logger.info("Step 1/2: Seeding countries...");
    await seedCountries();

    // Then seed states
    logger.info("Step 2/2: Seeding states...");
    await seedStates();

    logger.info("✅ Database seeding completed successfully!");
  } catch (error) {
    logger.error("❌ Database seeding failed:", error);
    throw error;
  }
}

/**
 * Run seeder (for CLI usage)
 */
async function runSeeder() {
  try {
    await runAllSeeders();
    process.exit(0);
  } catch (error) {
    logger.error("Seeder failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSeeder();
}
