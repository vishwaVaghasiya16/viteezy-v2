/**
 * @fileoverview Family Management Tests
 * @description Unit tests for family management functionality
 * @module tests/familyManagement.test
 */

import { familyLinkingService } from "../services/familyLinkingService";
import { UserRole } from "../models/enums";
import { AppError } from "../utils/AppError";

const { FamilyMapping, User } = require("../models/core") as any;

// Mock FamilyMapping model
jest.mock("../models/core/familyMapping.model", () => ({
  FamilyMapping: {
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn(),
      }),
    }),
  },
}));

// Mock User model
jest.mock("../models/core", () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
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

// Mock safety utilities
jest.mock("../utils/familyLinkingSafety", () => ({
  handleDuplicateKeyGracefully: jest.fn((error, context) => {
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

// Get the mocked models
const { FamilyMapping: FamilyMappingMock, User: UserMock } = require("../models/core/familyMapping.model") as any;

describe("Family Management Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserFamilyRole", () => {
    const mockUserId = "507f1f77bcf86cd799439011";

    it("should return SUB_MEMBER when user is a sub-member", async () => {
      // Mock sub-member mapping
      (FamilyMappingMock.findOne as jest.Mock).mockResolvedValue({
        subMemberId: mockUserId,
        mainMemberId: "507f1f77bcf86cd799439012",
      });

      const role = await familyLinkingService.getUserFamilyRole(mockUserId);

      expect(role).toBe(UserRole.SUB_MEMBER);
      expect(FamilyMappingMock.findOne).toHaveBeenCalledWith({
        subMemberId: mockUserId,
      });
    });

    it("should return MAIN_MEMBER when user has sub-members", async () => {
      // Mock no sub-member mapping but has sub-members
      (FamilyMappingMock.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMappingMock.countDocuments as jest.Mock).mockResolvedValue(2);

      const role = await familyLinkingService.getUserFamilyRole(mockUserId);

      expect(role).toBe(UserRole.MAIN_MEMBER);
      expect(FamilyMappingMock.findOne).toHaveBeenCalledWith({
        subMemberId: mockUserId,
      });
      expect(FamilyMappingMock.countDocuments).toHaveBeenCalledWith({
        mainMemberId: mockUserId,
      });
    });

    it("should return INDEPENDENT when user has no family mappings", async () => {
      // Mock no sub-member mapping and no sub-members
      (FamilyMappingMock.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMappingMock.countDocuments as jest.Mock).mockResolvedValue(0);

      const role = await familyLinkingService.getUserFamilyRole(mockUserId);

      expect(role).toBe(UserRole.INDEPENDENT);
      expect(FamilyMappingMock.findOne).toHaveBeenCalledWith({
        subMemberId: mockUserId,
      });
      expect(FamilyMappingMock.countDocuments).toHaveBeenCalledWith({
        mainMemberId: mockUserId,
      });
    });
  });

  describe("getSubMembers", () => {
    const mockMainMemberId = "507f1f77bcf86cd799439011";

    it("should return list of sub-members", async () => {
      const mockSubMembers = [
        {
          _id: "mapping1",
          subMemberId: { _id: "sub1", firstName: "John", lastName: "Doe", email: "john@example.com" },
          relationshipToParent: "Child",
          createdAt: new Date("2026-01-01"),
        },
        {
          _id: "mapping2",
          subMemberId: { _id: "sub2", firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
          relationshipToParent: "Spouse",
          createdAt: new Date("2026-01-02"),
        },
      ];

      (FamilyMapping.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSubMembers),
        }),
      });

      const result = await familyLinkingService.getSubMembers(mockMainMemberId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        _id: "mapping1",
        subMemberId: "sub1",
        subMember: { _id: "sub1", firstName: "John", lastName: "Doe", email: "john@example.com" },
        relationshipToParent: "Child",
        createdAt: new Date("2026-01-01"),
      });
      expect(FamilyMapping.find).toHaveBeenCalledWith({
        mainMemberId: mockMainMemberId,
      });
    });
  });

  describe("getFamilyDetails", () => {
    const mockUserId = "507f1f77bcf86cd799439011";

    it("should return sub-member details for SUB_MEMBER", async () => {
      // Mock user as SUB_MEMBER
      (FamilyMapping.findOne as jest.Mock)
        .mockResolvedValueOnce({
          subMemberId: mockUserId,
          mainMemberId: "507f1f77bcf86cd799439012",
        })
        .mockResolvedValueOnce(null);

      const mockMainMember = { _id: "main", firstName: "Main", lastName: "Member", email: "main@example.com" };
      const mockSiblings = [
        { _id: "sibling1", firstName: "Sibling", lastName: "One", email: "sibling@example.com" },
      ];

      (FamilyMapping.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValueOnce([mockMainMember]).mockResolvedValueOnce(mockSiblings),
        }),
      });

      const result = await familyLinkingService.getFamilyDetails(mockUserId);

      expect(result.role).toBe(UserRole.SUB_MEMBER);
      expect(result.mainMember).toEqual(mockMainMember);
      expect(result.siblings).toEqual(mockSiblings);
      expect(result.subMembers).toEqual([]);
    });

    it("should return sub-members list for MAIN_MEMBER", async () => {
      // Mock user as MAIN_MEMBER
      (FamilyMapping.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValue(2);

      const mockSubMembers = [
        { _id: "mapping1", subMemberId: { _id: "sub1", firstName: "John", lastName: "Doe" } },
      ];

      (FamilyMapping.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSubMembers),
        }),
      });

      const result = await familyLinkingService.getFamilyDetails(mockUserId);

      expect(result.role).toBe(UserRole.MAIN_MEMBER);
      expect(result.mainMember).toBeNull();
      expect(result.subMembers).toEqual(mockSubMembers);
    });

    it("should return empty structure for INDEPENDENT", async () => {
      // Mock user as INDEPENDENT
      (FamilyMapping.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValue(0);

      const result = await familyLinkingService.getFamilyDetails(mockUserId);

      expect(result.role).toBe(UserRole.INDEPENDENT);
      expect(result.mainMember).toBeNull();
      expect(result.subMembers).toEqual([]);
    });
  });

  describe("leaveFamily", () => {
    const mockSubMemberId = "507f1f77bcf86cd799439011";
    const mockMainMemberId = "507f1f77bcf86cd799439012";

    it("should allow sub-member to leave family successfully", async () => {
      // Mock user as SUB_MEMBER
      (FamilyMapping.findOne as jest.Mock)
        .mockResolvedValueOnce({
          subMemberId: mockSubMemberId,
          mainMemberId: mockMainMemberId,
        })
        .mockResolvedValueOnce({
          subMemberId: mockSubMemberId,
          mainMemberId: mockMainMemberId,
        });

      (FamilyMapping.deleteOne as jest.Mock).mockResolvedValue({});
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await familyLinkingService.leaveFamily(mockSubMemberId);

      expect(FamilyMapping.deleteOne).toHaveBeenCalledWith({
        subMemberId: mockSubMemberId,
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockSubMemberId,
        {
          role: UserRole.INDEPENDENT,
          isSubMember: false,
          parentMemberId: null,
          relationshipToParent: null,
        },
        { new: true, session: expect.any(Object) }
      );
    });

    it("should throw error when user is not a sub-member", async () => {
      // Mock user as MAIN_MEMBER
      (FamilyMapping.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValue(2);

      await expect(
        familyLinkingService.leaveFamily(mockSubMemberId)
      ).rejects.toThrow(AppError);
    });

    it("should handle idempotent leave gracefully", async () => {
      // Mock user as INDEPENDENT (already left)
      (FamilyMapping.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValue(0);

      await familyLinkingService.leaveFamily(mockSubMemberId);

      // Should not throw error for idempotent operation
      expect(FamilyMapping.deleteOne).not.toHaveBeenCalled();
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("removeSubMember", () => {
    const mockMainMemberId = "507f1f77bcf86cd799439011";
    const mockSubMemberId = "507f1f77bcf86cd799439012";

    it("should allow main member to remove sub-member successfully", async () => {
      // Mock main member with sub-members
      (FamilyMapping.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValue(2);

      (FamilyMapping.findOne as jest.Mock)
        .mockResolvedValueOnce({
          mainMemberId: mockMainMemberId,
          subMemberId: mockSubMemberId,
        })
        .mockResolvedValueOnce({
          mainMemberId: mockMainMemberId,
          subMemberId: mockSubMemberId,
        });

      (FamilyMapping.deleteOne as jest.Mock).mockResolvedValue({});
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValueOnce(2).mockResolvedValueOnce(0);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

      await familyLinkingService.removeSubMember(mockMainMemberId, mockSubMemberId);

      expect(FamilyMapping.deleteOne).toHaveBeenCalledWith({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
      });
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockSubMemberId,
        {
          role: UserRole.INDEPENDENT,
          isSubMember: false,
          parentMemberId: null,
          relationshipToParent: null,
        },
        { new: true, session: expect.any(Object) }
      );
    });

    it("should throw error when requester is not a main member", async () => {
      // Mock user as SUB_MEMBER
      (FamilyMapping.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValue(0);

      await expect(
        familyLinkingService.removeSubMember(mockMainMemberId, mockSubMemberId)
      ).rejects.toThrow(AppError);
    });

    it("should throw error when relationship does not exist", async () => {
      // Mock main member but no relationship
      (FamilyMapping.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMapping.countDocuments as jest.Mock).mockResolvedValue(2);

      (FamilyMapping.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        familyLinkingService.removeSubMember(mockMainMemberId, mockSubMemberId)
      ).rejects.toThrow(AppError);
    });
  });
});
