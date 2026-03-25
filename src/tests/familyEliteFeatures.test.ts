/**
 * @fileoverview Family Elite Features Tests
 * @description Unit tests for soft delete, events, and caching
 * @module tests/familyEliteFeatures.test
 */

import { familyLinkingService } from "../services/familyLinkingService";
import { UserRole } from "../models/enums";
import { FamilyMapping } from "../models/core/familyMapping.model";
import { FAMILY_EVENTS } from "../utils/familyEvents";
import {
  getCachedFamilyDetails,
  setCachedFamilyDetails,
  getCachedSubMembers,
  setCachedSubMembers,
  getCachedUserRole,
  setCachedUserRole,
  invalidateUserCache,
  getCacheStats,
} from "../utils/familyCache";

// Mock the enhanced FamilyMapping model
jest.mock("../models/core/familyMapping.model", () => ({
  FamilyMapping: {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn(),
      }),
    }),
  },
}));

// Mock mongoose for transactions
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

// Mock events
jest.mock("../utils/familyEvents", () => ({
  FAMILY_EVENTS: {
    MEMBER_LINKED: "FAMILY_MEMBER_LINKED",
    MEMBER_REMOVED: "FAMILY_MEMBER_REMOVED",
    MEMBER_LEFT: "FAMILY_MEMBER_LEFT",
  },
  emitFamilyMemberLinked: jest.fn().mockResolvedValue(undefined),
  emitFamilyMemberRemoved: jest.fn().mockResolvedValue(undefined),
  emitFamilyMemberLeft: jest.fn().mockResolvedValue(undefined),
}));

// Mock cache
jest.mock("../utils/familyCache", () => ({
  getCachedFamilyDetails: jest.fn(),
  setCachedFamilyDetails: jest.fn(),
  getCachedSubMembers: jest.fn(),
  setCachedSubMembers: jest.fn(),
  getCachedUserRole: jest.fn(),
  setCachedUserRole: jest.fn(),
  invalidateUserCache: jest.fn(),
  invalidateFamilyCache: jest.fn(),
  getCacheStats: jest.fn().mockReturnValue({
    size: 0,
    maxSize: 1000,
  }),
}));

const { FamilyMapping: FamilyMappingMock } = require("../models/core/familyMapping.model") as any;

describe("Family Elite Features", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Soft Delete Functionality", () => {
    const mockUserId = "507f1f77bcf86cd799439011";
    const mockMainMemberId = "507f1f77bcf86cd799439012";

    it("should soft delete family mapping on leave family", async () => {
      // Mock active mapping
      (FamilyMappingMock.findOne as jest.Mock).mockResolvedValue({
        subMemberId: mockUserId,
        mainMemberId: mockMainMemberId,
        isActive: true,
      });

      await familyLinkingService.leaveFamily(mockUserId);

      // Should call updateOne with soft delete fields
      expect(FamilyMappingMock.updateOne).toHaveBeenCalledWith(
        {
          subMemberId: mockUserId,
          isActive: true,
        },
        {
          isActive: false,
          removedAt: expect.any(Date),
          removedBy: mockUserId,
        },
        expect.any(Object) // session object
      );
    });

    it("should only query active mappings", async () => {
      await familyLinkingService.getUserFamilyRole(mockUserId);

      // Should query with isActive: true filter
      expect(FamilyMappingMock.findOne).toHaveBeenCalledWith({
        subMemberId: mockUserId,
        isActive: true,
      });
    });

    it("should count only active sub-members", async () => {
      await familyLinkingService.getSubMembers(mockMainMemberId);

      // Should count with isActive: true filter
      expect(FamilyMappingMock.countDocuments).toHaveBeenCalledWith({
        mainMemberId: mockMainMemberId,
        isActive: true,
      });
    });
  });

  describe("Event System", () => {
    const mockMainMemberId = "507f1f77bcf86cd799439011";
    const mockSubMemberId = "507f1f77bcf86cd799439012";

    it("should emit FAMILY_MEMBER_LINKED event on successful linking", async () => {
      const { emitFamilyMemberLinked } = require("../utils/familyEvents");
      
      // Mock successful linking
      (FamilyMappingMock.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMappingMock.countDocuments as jest.Mock).mockResolvedValue(0);
      (FamilyMappingMock.create as jest.Mock).mockResolvedValue({});

      await familyLinkingService.linkFamilyMember(mockMainMemberId, mockSubMemberId, "Child");

      // Should emit event
      expect(emitFamilyMemberLinked).toHaveBeenCalledWith({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
        relationshipToParent: "Child",
        actionBy: mockMainMemberId,
        timestamp: expect.any(Date),
      });
    });

    it("should emit FAMILY_MEMBER_REMOVED event on successful removal", async () => {
      const { emitFamilyMemberRemoved } = require("../utils/familyEvents");
      
      // Mock successful removal
      (FamilyMappingMock.findOne as jest.Mock).mockResolvedValue({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
        isActive: true,
      });

      await familyLinkingService.removeSubMember(mockMainMemberId, mockSubMemberId);

      // Should emit event
      expect(emitFamilyMemberRemoved).toHaveBeenCalledWith({
        mainMemberId: mockMainMemberId,
        subMemberId: mockSubMemberId,
        actionBy: mockMainMemberId,
        timestamp: expect.any(Date),
      });
    });

    it("should emit FAMILY_MEMBER_LEFT event on successful leave", async () => {
      const { emitFamilyMemberLeft } = require("../utils/familyEvents");
      
      // Mock successful leave
      (FamilyMappingMock.findOne as jest.Mock).mockResolvedValue({
        subMemberId: mockSubMemberId,
        mainMemberId: mockMainMemberId,
        isActive: true,
      });

      await familyLinkingService.leaveFamily(mockSubMemberId);

      // Should emit event
      expect(emitFamilyMemberLeft).toHaveBeenCalledWith({
        subMemberId: mockSubMemberId,
        mainMemberId: mockMainMemberId,
        actionBy: mockSubMemberId,
        timestamp: expect.any(Date),
      });
    });
  });

  describe("Caching System", () => {
    const mockUserId = "507f1f77bcf86cd799439011";
    const mockMainMemberId = "507f1f77bcf86cd799439012";

    it("should cache user role", async () => {
      const { getCachedUserRole, setCachedUserRole } = require("../utils/familyCache");
      
      // First call should check cache
      await familyLinkingService.getUserFamilyRole(mockUserId);
      expect(getCachedUserRole).toHaveBeenCalledWith(mockUserId);

      // Should set cache after DB query
      expect(setCachedUserRole).toHaveBeenCalledWith(mockUserId, UserRole.INDEPENDENT);
    });

    it("should return cached user role on second call", async () => {
      const { getCachedUserRole } = require("../utils/familyCache");
      
      // Mock cache hit
      (getCachedUserRole as jest.Mock).mockReturnValue(UserRole.MAIN_MEMBER);

      const role = await familyLinkingService.getUserFamilyRole(mockUserId);

      expect(role).toBe(UserRole.MAIN_MEMBER);
      expect(getCachedUserRole).toHaveBeenCalledWith(mockUserId);
    });

    it("should cache family details", async () => {
      const { getCachedFamilyDetails, setCachedFamilyDetails } = require("../utils/familyCache");
      
      // Mock cached result
      const cachedData = { role: UserRole.MAIN_MEMBER, subMembers: [], mainMember: null };
      (getCachedFamilyDetails as jest.Mock).mockReturnValue(cachedData);

      const result = await familyLinkingService.getFamilyDetails(mockUserId);

      expect(result).toEqual(cachedData);
      expect(getCachedFamilyDetails).toHaveBeenCalledWith(mockUserId);
    });

    it("should cache sub-members", async () => {
      const { getCachedSubMembers, setCachedSubMembers } = require("../utils/familyCache");
      
      // Mock cached result
      const cachedData = [{ _id: "1", subMember: { firstName: "John" } }];
      (getCachedSubMembers as jest.Mock).mockReturnValue(cachedData);

      const result = await familyLinkingService.getSubMembers(mockMainMemberId);

      expect(result).toEqual(cachedData);
      expect(setCachedSubMembers).toHaveBeenCalledWith(mockMainMemberId, cachedData);
    });

    it("should invalidate cache on family changes", async () => {
      const { invalidateUserCache } = require("../utils/familyCache");
      
      await familyLinkingService.leaveFamily(mockUserId);

      // Should invalidate cache for both users
      expect(invalidateUserCache).toHaveBeenCalledWith(mockUserId);
      expect(invalidateUserCache).toHaveBeenCalledTimes(2); // Once for sub-member, once for main member
    });

    it("should provide cache statistics", () => {
      const { getCacheStats } = require("../utils/familyCache");
      
      const stats = getCacheStats();

      expect(stats).toEqual({
        size: 0,
        maxSize: 1000,
      });
    });
  });

  describe("Integration Tests", () => {
    it("should work end-to-end with all elite features", async () => {
      const mockUserId = "507f1f77bcf86cd799439011";
      const mockMainMemberId = "507f1f77bcf86cd799439012";

      // Mock cache miss for first call
      const { getCachedUserRole } = require("../utils/familyCache");
      (getCachedUserRole as jest.Mock).mockReturnValue(null);

      // Mock successful linking
      (FamilyMappingMock.findOne as jest.Mock).mockResolvedValue(null);
      (FamilyMappingMock.countDocuments as jest.Mock).mockResolvedValue(0);
      (FamilyMappingMock.create as jest.Mock).mockResolvedValue({});

      await familyLinkingService.linkFamilyMember(mockMainMemberId, mockUserId, "Child");

      // Verify cache was set
      expect(setCachedUserRole).toHaveBeenCalledWith(mockUserId, UserRole.SUB_MEMBER);
      expect(invalidateUserCache).toHaveBeenCalledWith(mockUserId);
      expect(invalidateUserCache).toHaveBeenCalledWith(mockMainMemberId);
    });
  });
});
