/**
 * @fileoverview Family Linking Unit Tests
 * @description Unit tests for family linking functionality
 * @module tests/familyLinking.test
 */

import { familyLinkingService } from "../services/familyLinkingService";
import { User } from "../models/core";
import { FamilyMapping } from "../models/core/familyMapping.model";
import { UserRole } from "../models/enums";
import { AppError } from "../utils/AppError";
import { generateMemberId } from "../utils/memberIdGenerator";

// Mock the validation service
jest.mock("../services/familyValidationService", () => ({
  familyValidationService: {
    validateFamilyLinking: jest.fn(),
  },
}));

// Mock the logger
jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the User model
jest.mock("../models/core/users.model", () => ({
  User: {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn(),
      }),
    }),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
  },
}));

// Mock the FamilyMapping model
jest.mock("../models/core/familyMapping.model", () => ({
  FamilyMapping: {
    create: jest.fn(),
    findOne: jest.fn().mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn(),
      }),
    }),
    findOneAndDelete: jest.fn().mockReturnValue({
      session: jest.fn(),
    }),
    countDocuments: jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(0),
    }),
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn(),
      }),
    }),
  },
}));

// Mock the memberIdGenerator (but not the validation function)
jest.mock("../utils/memberIdGenerator", () => ({
  generateMemberId: jest.fn(),
  findUserByMemberId: jest.fn(),
  isValidMemberIdFormat: jest.requireActual("../utils/memberIdGenerator").isValidMemberIdFormat,
}));

// Mock mongoose for transactions - only mock startSession
jest.mock("mongoose", () => {
  const actualMongoose = jest.requireActual("mongoose");
  return {
    ...actualMongoose,
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      endSession: jest.fn(),
      inTransaction: true,
      transaction: { isActive: true }
    }),
  };
});

// Mock the safety utilities
jest.mock("../utils/familyLinkingSafety", () => ({
  handleDuplicateKeyGracefully: jest.fn((error, context) => {
    // Simulate handling duplicate key errors gracefully
    if (error && error.message && error.message.includes('duplicate key')) {
      return true;
    }
    return false;
  }),
  createTransactionContext: jest.fn((operationName, additionalContext) => ({
    transactionId: 'test-tx-id',
    operationName,
    timestamp: new Date().toISOString(),
    ...additionalContext
  })),
  logTransactionEvent: jest.fn(),
  validateSession: jest.fn(),
  safeAbortTransaction: jest.fn(),
  safeCommitTransaction: jest.fn(),
  enhanceErrorInfo: jest.fn((error, context) => ({
    message: error.message,
    context,
    timestamp: new Date().toISOString()
  })),
}));

describe("Family Linking Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("linkFamilyMember", () => {
    const mockMainMemberId = "507f1f77bcf86cd799439011";
    const mockSubMemberId = "507f1f77bcf86cd799439012";

    it("should successfully link family members", async () => {
      // Mock validation service
      const { familyValidationService } = require("../services/familyValidationService");
      familyValidationService.validateFamilyLinking.mockResolvedValue(undefined);

      // Mock existing mapping check (returns null - no existing mapping)
      const mockLean = jest.fn().mockResolvedValue(null);
      const mockSession = jest.fn().mockReturnValue({ lean: mockLean });
      const mockFindOne = jest.fn().mockReturnValue({ session: mockSession });
      (FamilyMapping.findOne as jest.Mock) = mockFindOne;

      // Mock FamilyMapping.create
      (FamilyMapping.create as jest.Mock).mockResolvedValue({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
      });

      // Mock User.findByIdAndUpdate
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await familyLinkingService.linkFamilyMember(mockMainMemberId, mockSubMemberId);

      expect(familyValidationService.validateFamilyLinking).toHaveBeenCalledWith(
        mockMainMemberId,
        mockSubMemberId
      );
      expect(FamilyMapping.create).toHaveBeenCalledWith([{
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
      }], expect.objectContaining({ session: expect.any(Object) }));
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });

    it("should handle existing mapping idempotently", async () => {
      // Mock validation service
      const { familyValidationService } = require("../services/familyValidationService");
      familyValidationService.validateFamilyLinking.mockResolvedValue(undefined);

      // Mock existing mapping check (returns existing mapping)
      const mockLean = jest.fn().mockResolvedValue({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
      });
      const mockSession = jest.fn().mockReturnValue({ lean: mockLean });
      const mockFindOne = jest.fn().mockReturnValue({ session: mockSession });
      (FamilyMapping.findOne as jest.Mock) = mockFindOne;

      await familyLinkingService.linkFamilyMember(mockMainMemberId, mockSubMemberId);

      expect(FamilyMapping.create).not.toHaveBeenCalled();
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("should throw error when validation fails", async () => {
      // Mock validation service to throw error
      const { familyValidationService } = require("../services/familyValidationService");
      familyValidationService.validateFamilyLinking.mockRejectedValue(
        new AppError("Validation failed", 400, true, "VALIDATION_ERROR")
      );

      await expect(
        familyLinkingService.linkFamilyMember(mockMainMemberId, mockSubMemberId)
      ).rejects.toThrow(AppError);
    });
  });

  describe("linkByMemberId", () => {
    const mockMemberId = "MEM-A9XK72QD";
    const mockCurrentUserId = "507f1f77bcf86cd799439013";
    const mockMainMemberId = "507f1f77bcf86cd799439014";

    it("should successfully link by member ID", async () => {
      // Import the real validation function
      const { isValidMemberIdFormat } = require("../utils/memberIdGenerator");
      
      // Mock findUserByMemberId
      (require("../utils/memberIdGenerator").findUserByMemberId as jest.Mock).mockResolvedValue({
        _id: mockMainMemberId,
        memberId: mockMemberId,
      });

      // Mock linkFamilyMember
      jest.spyOn(familyLinkingService, "linkFamilyMember").mockResolvedValue(undefined);

      await familyLinkingService.linkByMemberId(mockMemberId, mockCurrentUserId);

      // Verify the function works (not called, but the logic should work)
      expect(isValidMemberIdFormat(mockMemberId)).toBe(true);
      expect(require("../utils/memberIdGenerator").findUserByMemberId).toHaveBeenCalledWith(
        mockMemberId
      );
      expect(familyLinkingService.linkFamilyMember).toHaveBeenCalledWith(
        mockMainMemberId,
        mockCurrentUserId,
        undefined
      );
    });

    it("should throw error for invalid member ID format", async () => {
      // Import the real validation function
      const { isValidMemberIdFormat } = require("../utils/memberIdGenerator");

      await expect(
        familyLinkingService.linkByMemberId("INVALID-ID", mockCurrentUserId)
      ).rejects.toThrow(AppError);
    });

    it("should throw error when member ID not found", async () => {
      // Import the real validation function
      const { isValidMemberIdFormat } = require("../utils/memberIdGenerator");

      // Mock findUserByMemberId to return null
      (require("../utils/memberIdGenerator").findUserByMemberId as jest.Mock).mockResolvedValue(null);

      await expect(
        familyLinkingService.linkByMemberId(mockMemberId, mockCurrentUserId)
      ).rejects.toThrow(AppError);
    });
  });

  describe("unlinkFamilyMember", () => {
    const mockMainMemberId = "507f1f77bcf86cd799439011";
    const mockSubMemberId = "507f1f77bcf86cd799439012";

    it("should successfully unlink family members", async () => {
      // Mock FamilyMapping.findOneAndDelete
      const mockSession = jest.fn().mockResolvedValue({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
      });
      const mockFindOneAndDelete = jest.fn().mockReturnValue({ session: mockSession });
      (FamilyMapping.findOneAndDelete as jest.Mock) = mockFindOneAndDelete;

      // Mock FamilyMapping.countDocuments (no remaining sub-members)
      const mockSessionCount = jest.fn().mockResolvedValue(0);
      const mockCountDocuments = jest.fn().mockReturnValue({ session: mockSessionCount });
      (FamilyMapping.countDocuments as jest.Mock) = mockCountDocuments;

      // Mock User.findByIdAndUpdate
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await familyLinkingService.unlinkFamilyMember(mockMainMemberId, mockSubMemberId);

      expect(FamilyMapping.findOneAndDelete).toHaveBeenCalledWith({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(2); // Once for sub-member, once for main member
    });

    it("should throw error when mapping not found", async () => {
      // Mock FamilyMapping.findOneAndDelete to return null
      const mockSession = jest.fn().mockResolvedValue(null);
      const mockFindOneAndDelete = jest.fn().mockReturnValue({ session: mockSession });
      (FamilyMapping.findOneAndDelete as jest.Mock) = mockFindOneAndDelete;

      await expect(
        familyLinkingService.unlinkFamilyMember(mockMainMemberId, mockSubMemberId)
      ).rejects.toThrow(AppError);
    });

    it("should keep main member as MAIN_MEMBER if other sub-members exist", async () => {
      // Mock FamilyMapping.findOneAndDelete
      const mockSession = jest.fn().mockResolvedValue({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
      });
      const mockFindOneAndDelete = jest.fn().mockReturnValue({ session: mockSession });
      (FamilyMapping.findOneAndDelete as jest.Mock) = mockFindOneAndDelete;

      // Mock FamilyMapping.countDocuments (remaining sub-members exist)
      const mockSessionCount = jest.fn().mockResolvedValue(2);
      const mockCountDocuments = jest.fn().mockReturnValue({ session: mockSessionCount });
      (FamilyMapping.countDocuments as jest.Mock) = mockCountDocuments;

      // Mock User.findByIdAndUpdate
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await familyLinkingService.unlinkFamilyMember(mockMainMemberId, mockSubMemberId);

      expect(User.findByIdAndUpdate).toHaveBeenCalledTimes(1); // Only for sub-member
    });
  });

  describe("getFamilyMembers", () => {
    const mockMainMemberId = "507f1f77bcf86cd799439011";

    it("should return family members", async () => {
      const mockFamilyMembers = [
        {
          mainMemberId: mockMainMemberId,
          subMemberId: { _id: "507f1f77bcf86cd799439012", firstName: "John", lastName: "Doe" },
        },
      ];

      // Mock FamilyMapping.find with populate
      const mockLean = jest.fn().mockResolvedValue(mockFamilyMembers);
      const mockPopulate = jest.fn().mockReturnValue({ lean: mockLean });
      const mockFind = jest.fn().mockReturnValue({ populate: mockPopulate });
      (FamilyMapping.find as jest.Mock) = mockFind;

      const result = await familyLinkingService.getFamilyMembers(mockMainMemberId);

      expect(FamilyMapping.find).toHaveBeenCalledWith({ mainMemberId: mockMainMemberId });
      expect(result).toEqual(mockFamilyMembers);
    });
  });

  describe("getFamilyInfo", () => {
    const mockUserId = "507f1f77bcf86cd799439013";

    it("should return family info for sub-member", async () => {
      const mockUser = {
        isSubMember: true,
        parentMemberId: "507f1f77bcf86cd799439014",
      };

      const mockMainMember = {
        _id: "507f1f77bcf86cd799439014",
        firstName: "Jane",
        lastName: "Doe",
      };

      const mockSiblings = [
        {
          subMemberId: { _id: "507f1f77bcf86cd799439015", firstName: "Bob", lastName: "Doe" },
        },
      ];

      // Mock User.findById to return different values based on the call
      const mockUserLookup = jest.fn().mockImplementation((id) => {
        if (id === mockUserId) {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockUser),
            }),
          };
        } else if (id === mockUser.parentMemberId) {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockMainMember),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        };
      });
      (User.findById as jest.Mock) = mockUserLookup;

      // Mock FamilyMapping.find for siblings
      const mockLean2 = jest.fn().mockResolvedValue(mockSiblings);
      const mockPopulate = jest.fn().mockReturnValue({ lean: mockLean2 });
      const mockFind2 = jest.fn().mockReturnValue({ populate: mockPopulate });
      (FamilyMapping.find as jest.Mock) = mockFind2;

      // Mock getFamilyMembers
      jest.spyOn(familyLinkingService, "getFamilyMembers").mockResolvedValue([]);

      const result = await familyLinkingService.getFamilyInfo(mockUserId);

      expect(result.role).toBe("SUB_MEMBER");
      expect(result.mainMember).toEqual(mockMainMember);
      expect(result.siblings).toEqual(mockSiblings);
    });

    it("should return family info for main member", async () => {
      const mockUser = {
        isSubMember: false,
        parentMemberId: null,
      };

      const mockSubMembers = [
        {
          subMemberId: { _id: "507f1f77bcf86cd799439015", firstName: "Bob", lastName: "Doe" },
        },
      ];

      // Mock User.findById
      const mockLean = jest.fn().mockResolvedValue(mockUser);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      const mockFindById = jest.fn().mockReturnValue({ select: mockSelect });
      (User.findById as jest.Mock) = mockFindById;

      // Mock getFamilyMembers
      jest.spyOn(familyLinkingService, "getFamilyMembers").mockResolvedValue(mockSubMembers);

      const result = await familyLinkingService.getFamilyInfo(mockUserId);

      expect(result.role).toBe("MAIN_MEMBER");
      expect(result.subMembers).toEqual(mockSubMembers);
    });

    it("should return family info for independent user", async () => {
      const mockUser = {
        isSubMember: false,
        parentMemberId: null,
      };

      // Mock User.findById
      const mockLean = jest.fn().mockResolvedValue(mockUser);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      const mockFindById = jest.fn().mockReturnValue({ select: mockSelect });
      (User.findById as jest.Mock) = mockFindById;

      // Mock getFamilyMembers (returns empty array)
      jest.spyOn(familyLinkingService, "getFamilyMembers").mockResolvedValue([]);

      const result = await familyLinkingService.getFamilyInfo(mockUserId);

      expect(result.role).toBe("INDEPENDENT");
      expect(result.subMembers).toEqual([]);
    });

    it("should throw error when user not found", async () => {
      // Mock User.findById to return null
      const mockLean = jest.fn().mockResolvedValue(null);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      const mockFindById = jest.fn().mockReturnValue({ select: mockSelect });
      (User.findById as jest.Mock) = mockFindById;

      await expect(familyLinkingService.getFamilyInfo(mockUserId)).rejects.toThrow(AppError);
    });
  });
});

describe("Member ID Generator", () => {
  describe("isValidMemberIdFormat", () => {
    it("should validate correct member ID format", () => {
      const { isValidMemberIdFormat } = require("../utils/memberIdGenerator");
      
      expect(isValidMemberIdFormat("MEM-A9XK72QD")).toBe(true);
      expect(isValidMemberIdFormat("MEM-12345678")).toBe(true);
      expect(isValidMemberIdFormat("MEM-ABCDEFGH")).toBe(true);
    });

    it("should reject invalid member ID format", () => {
      const { isValidMemberIdFormat } = require("../utils/memberIdGenerator");
      
      expect(isValidMemberIdFormat("MEM-A9XK72Q")).toBe(false); // Too short
      expect(isValidMemberIdFormat("MEM-A9XK72QD123")).toBe(false); // Too long
      expect(isValidMemberIdFormat("mem-A9XK72QD")).toBe(false); // Lowercase prefix
      expect(isValidMemberIdFormat("MEM-a9xk72qd")).toBe(false); // Lowercase letters
      expect(isValidMemberIdFormat("A9XK72QD")).toBe(false); // Missing prefix
      expect(isValidMemberIdFormat("MEM-A9XK72QD-EXTRA")).toBe(false); // Extra parts
    });
  });
});
