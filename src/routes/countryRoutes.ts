import { Router } from "express";
import { CountryController } from "@/controllers/countryController";

const router = Router();

/**
 * Public Routes
 */

// Get all countries
router.get("/", CountryController.getAllCountries);

// Get country by code (alpha-2, alpha-3, or numeric)
router.get("/:code", CountryController.getCountryByCode);

export default router;
