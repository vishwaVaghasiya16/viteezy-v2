import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { User } from "@/models/core/users.model";
import { MemberReferrals } from "@/models/core/memberReferrals.model";
import {
  generateMemberId,
  findUserByMemberId,
  isValidMemberIdFormat,
} from "@/utils/memberIdGenerator";
import { logger } from "@/utils/logger";
import bcrypt from "bcryptjs";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email?: string;
    name?: string;
  };
}

class MemberController {
  /**
   * Register user with parent member ID
   * @route POST /api/v1/members/register
   * @access Public
   */
  registerWithMemberId = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const {
        name,
        email,
        password,
        phone,
        parentMemberId,
        registrationSource = "registration",
        metadata,
      } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        throw new AppError("Name, email, and password are required", 400);
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new AppError("User with this email already exists", 400);
      }

      // Validate and find parent user if parentMemberId is provided
      let parentUser = null;
      if (parentMemberId) {
        if (!isValidMemberIdFormat(parentMemberId)) {
          throw new AppError("Invalid parent member ID format", 400);
        }

        parentUser = await findUserByMemberId(parentMemberId);
        if (!parentUser) {
          throw new AppError("Parent member ID not found", 404);
        }
      }

      // Generate unique member ID for new user
      const memberId = await generateMemberId();

      // Create new user
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password,
        phone,
        memberId,
        isActive: true,
        isEmailVerified: false,
      });

      // Create referral relationship if parent member ID was provided
      if (parentUser) {
        await MemberReferrals.create({
          childUserId: user._id,
          parentUserId: new mongoose.Types.ObjectId(parentUser._id),
          parentMemberId: parentMemberId.toUpperCase(),
          registeredAt: new Date(),
          registrationSource: registrationSource as "registration" | "quiz",
          isActive: true,
          metadata: metadata || {},
        });

        logger.info(
          `User ${user._id} registered with parent member ID ${parentMemberId}`
        );
      }

      logger.info(`New user registered with member ID: ${memberId}`);

      // Remove password from response
      const userResponse: any = user.toObject();
      if ("password" in userResponse) {
        delete userResponse.password;
      }

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: userResponse,
          memberId,
          parentMemberId: parentMemberId || null,
        },
      });
    }
  );

  /**
   * Get user's member ID and referral info
   * @route GET /api/v1/members/me
   * @access Private
   */
  getMyMemberInfo = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const user = await User.findById(req.user._id).select(
        "name email memberId isMember membershipStatus"
      );

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Get referral info (if user was referred)
      const referral = await MemberReferrals.findOne({
        childUserId: new mongoose.Types.ObjectId(req.user._id),
        isActive: true,
        isDeleted: false,
      })
        .populate("parentUserId", "name email memberId")
        .lean();

      // Get referrals made by this user (children)
      const myReferrals = await MemberReferrals.find({
        parentUserId: new mongoose.Types.ObjectId(req.user._id),
        isActive: true,
        isDeleted: false,
      })
        .populate("childUserId", "name email memberId")
        .sort({ registeredAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        message: "Member information retrieved successfully",
        data: {
          memberId: user.memberId,
          isMember: user.isMember,
          membershipStatus: user.membershipStatus,
          referral: referral
            ? {
                parentMemberId: referral.parentMemberId,
                parentUser: referral.parentUserId,
                registeredAt: referral.registeredAt,
                registrationSource: referral.registrationSource,
              }
            : null,
          myReferrals: myReferrals.map((ref) => ({
            childUser: ref.childUserId,
            registeredAt: ref.registeredAt,
            registrationSource: ref.registrationSource,
          })),
          referralCount: myReferrals.length,
        },
      });
    }
  );

  /**
   * Get child members linked to the authenticated parent
   * @route GET /api/v1/members/children
   * @access Private
   */
  getMyChildMembers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const referrals = await MemberReferrals.find({
        parentUserId: new mongoose.Types.ObjectId(req.user._id),
        isActive: true,
        isDeleted: false,
      })
        .populate("childUserId", "name email memberId isActive")
        .sort({ registeredAt: -1 })
        .lean();

      const children = referrals
        .filter((ref) => ref.childUserId)
        .map((ref) => {
          const child = ref.childUserId as any;
          return {
            userId: child._id,
            name: child.name,
            email: child.email,
            memberId: child.memberId,
            isActive: child.isActive,
            registeredAt: ref.registeredAt,
            registrationSource: ref.registrationSource,
          };
        });

      res.status(200).json({
        success: true,
        message: "Child members retrieved successfully",
        data: {
          parentUserId: req.user._id,
          children,
          count: children.length,
        },
      });
    }
  );

  /**
   * Verify member ID exists
   * @route GET /api/v1/members/verify/:memberId
   * @access Public
   */
  verifyMemberId = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { memberId } = req.params;

      if (!isValidMemberIdFormat(memberId)) {
        res.status(200).json({
          success: false,
          message: "Invalid member ID format",
          data: { valid: false },
        });
        return;
      }

      const user = await findUserByMemberId(memberId);

      res.status(200).json({
        success: true,
        message: user ? "Member ID found" : "Member ID not found",
        data: {
          valid: !!user,
          memberId: user?.memberId || null,
          name: user?.name || null,
        },
      });
    }
  );
}

export const memberController = new MemberController();
