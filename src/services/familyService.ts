import { User } from '../models/core/users.model';

// This service now only contains family-related utilities
// All validation has been moved to familyValidationService.ts

// Re-export from centralized validation service for backward compatibility
export { getUserFamilyRole } from './familyValidationService';
