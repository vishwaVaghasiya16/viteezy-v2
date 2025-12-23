# Database Seeders

This directory contains database seeders for populating the database with initial data.

## Available Seeders

### 1. Country Seeder (`countrySeeder.ts`)

Imports countries from ISO 3166 standard CSV file.

**Source:** https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes

**Fields:**

- `name` - Country name
- `alpha2` - ISO 3166-1 alpha-2 code (2 letters, e.g., "US", "NL")
- `alpha3` - ISO 3166-1 alpha-3 code (3 letters, e.g., "USA", "NLD")
- `numeric` - ISO 3166-1 numeric code (e.g., "840", "528")
- `region` - Region (e.g., "Europe", "Americas")
- `subRegion` - Sub-region (e.g., "Western Europe", "Northern America")

**Usage:**

```bash
npm run seed:countries
```

### 2. State Seeder (`stateSeeder.ts`)

Imports states/provinces for various countries.

**Source:** `data/states.json` or built-in common states

**Fields:**

- `name` - State/Province name
- `code` - State code (e.g., "CA", "NY")
- `countryCode` - ISO alpha-2 country code
- `type` - Type (e.g., "state", "province", "territory")

**Usage:**

```bash
npm run seed:states
```

### 3. Combined Seeder (`index.ts`)

Runs both country and state seeders in sequence.

**Usage:**

```bash
npm run seed
```

## How It Works

1. **Country Seeder:**

   - Downloads CSV from GitHub (if not exists locally)
   - Parses CSV file
   - Transforms data to match schema
   - Inserts into `countries` collection
   - Creates indexes for efficient queries

2. **State Seeder:**
   - Loads states from `data/states.json` or uses built-in data
   - Links states to countries via `countryCode`
   - Inserts into `states` collection
   - Creates indexes for efficient queries

## Adding More States

To add states for more countries, edit `data/states.json`:

```json
{
  "US": [{ "name": "California", "code": "CA" }],
  "CA": [{ "name": "Ontario", "code": "ON", "type": "province" }]
}
```

Or update the `COMMON_STATES_DATA` object in `stateSeeder.ts`.

## Notes

- Seeders are **idempotent** - safe to run multiple times
- Existing data will be cleared before seeding (countries and states)
- Seeders handle errors gracefully and log warnings
- CSV file is cached locally after first download

## Troubleshooting

### CSV Download Fails

- Check internet connection
- Manually download CSV from GitHub and place in `data/countries.csv`

### Duplicate Key Errors

- Seeders handle duplicates automatically
- If issues persist, clear collections manually:
  ```bash
  mongosh your-database-name
  db.countries.drop()
  db.states.drop()
  ```

### States Not Linking to Countries

- Ensure countries are seeded first
- Verify country codes match (case-insensitive)
- Check logs for warnings about missing countries
