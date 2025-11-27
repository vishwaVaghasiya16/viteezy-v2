/**
 * Member ID Generator Utility
 * Generates unique member IDs in format: MEM-XXXXX
 * Format: MEM-A9XK72QD, MEM-QW7P9L3Z
 */

import { User } from "@/models/core/users.model";

const MEMBER_ID_PREFIX = "MEM-";
const MEMBER_ID_LENGTH = 8; // 8 characters after MEM-

/**
 * Generate a random alphanumeric string
 * Uses uppercase letters and numbers, excludes similar-looking characters (0, O, I, 1)
 */
function generateRandomCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes 0, O, I, 1
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a unique member ID
 * Format: MEM-XXXXXXXX (e.g., MEM-A9XK72QD)
 */
export async function generateMemberId(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateRandomCode(MEMBER_ID_LENGTH);
    const memberId = `${MEMBER_ID_PREFIX}${code}`;

    // Check if member ID already exists in User collection
    const existingUser = await User.findOne({ memberId }).select("_id").lean();
    if (!existingUser) {
      return memberId;
    }

    attempts++;
  }

  throw new Error(
    `Failed to generate unique member ID after ${maxAttempts} attempts`
  );
}

/**
 * Validate member ID format
 */
export function isValidMemberIdFormat(memberId: string): boolean {
  const pattern = /^MEM-[A-Z0-9]{8}$/;
  return pattern.test(memberId);
}

/**
 * Find user by member ID
 */
export async function findUserByMemberId(
  memberId: string
): Promise<any | null> {
  if (!isValidMemberIdFormat(memberId)) {
    return null;
  }

  return await User.findOne({ memberId, isActive: true })
    .select("_id name email memberId")
    .lean();
}
