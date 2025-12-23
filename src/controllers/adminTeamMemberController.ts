import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  asyncHandler,
  getPaginationMeta,
  getPaginationOptions,
  markdownI18nToHtml,
} from "@/utils";
import { AppError } from "@/utils/AppError";
import { TeamMembers } from "@/models/cms/teamMembers.model";
import { fileStorageService } from "@/services/fileStorageService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class AdminTeamMemberController {
  private normalizeImageInput(value: any): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (
      !trimmed ||
      trimmed.toLowerCase() === "null" ||
      trimmed.toLowerCase() === "undefined"
    ) {
      return null;
    }

    return trimmed;
  }

  private async uploadImage(
    file?: Express.Multer.File
  ): Promise<string | null> {
    if (!file) {
      return null;
    }

    try {
      return await fileStorageService.uploadFile("team-members", file);
    } catch (error: any) {
      logger.error("Failed to upload team member image to cloud storage", {
        error: error.message,
        fileName: file.originalname,
        stack: error.stack,
      });

      logger.warn(
        "Team member will be created without image due to upload failure. Please check DigitalOcean Spaces configuration."
      );
      return null;
    }
  }

  private async deleteImage(url?: string | null): Promise<void> {
    if (!url) {
      return;
    }

    try {
      await fileStorageService.deleteFileByUrl(url);
    } catch (error) {
      logger.warn("Failed to delete team member image", { url, error });
    }
  }

  /**
   * Create a new team member
   */
  createTeamMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const { name, designation, content, image } = req.body;

      let imageUrl = this.normalizeImageInput(image);
      if (req.file) {
        try {
          const uploadedUrl = await this.uploadImage(req.file);
          if (uploadedUrl) {
            imageUrl = uploadedUrl;
          } else {
            logger.warn(
              "Image upload failed, creating team member without image"
            );
          }
        } catch (error: any) {
          logger.error("Error uploading image", {
            error: error.message,
            fileName: req.file.originalname,
          });
        }
      }

      const teamMember = await TeamMembers.create({
        name,
        designation,
        content,
        image: imageUrl ?? null,
        createdBy: requesterId,
      });

      // Convert to plain object with proper serialization
      const teamMemberObj = JSON.parse(JSON.stringify(teamMember.toObject()));
      const contentObj = teamMemberObj.content || {};

      // Convert markdown content to HTML for response
      const transformedTeamMember = {
        ...teamMemberObj,
        content: markdownI18nToHtml(
          contentObj as Record<string, string | null | undefined>
        ),
      };

      res.apiCreated(
        { teamMember: transformedTeamMember },
        "Team member created successfully"
      );
    }
  );

  /**
   * Get paginated list of all team members (Admin view)
   */
  getTeamMembers = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { search } = req.query as {
        search?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { "designation.en": { $regex: search, $options: "i" } },
          { "designation.nl": { $regex: search, $options: "i" } },
          { "designation.de": { $regex: search, $options: "i" } },
          { "designation.fr": { $regex: search, $options: "i" } },
          { "designation.es": { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [teamMembers, total] = await Promise.all([
        TeamMembers.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        TeamMembers.countDocuments(filter),
      ]);

      // Convert markdown content to HTML
      const transformedTeamMembers = teamMembers.map((member: any) => {
        const contentObj = member.content || {};
        return {
          ...member,
          content: markdownI18nToHtml(
            contentObj as Record<string, string | null | undefined>
          ),
        };
      });

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(transformedTeamMembers, pagination, "Team members retrieved");
    }
  );

  /**
   * Get team member by ID
   */
  getTeamMemberById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const teamMember = await TeamMembers.findOne({
        _id: id,
        isDeleted: false,
      }).lean();

      if (!teamMember) {
        throw new AppError("Team member not found", 404);
      }

      // Extract content properly (already plain object from .lean())
      const contentObj = teamMember.content || {};

      // Convert markdown content to HTML
      const transformedTeamMember = {
        ...teamMember,
        content: markdownI18nToHtml(
          contentObj as Record<string, string | null | undefined>
        ),
      };

      res.apiSuccess(
        { teamMember: transformedTeamMember },
        "Team member retrieved successfully"
      );
    }
  );

  /**
   * Update team member
   */
  updateTeamMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { name, designation, content, image } = req.body;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const teamMember = await TeamMembers.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!teamMember) {
        throw new AppError("Team member not found", 404);
      }

      if (name) teamMember.name = name;
      if (designation) teamMember.designation = designation;
      if (content !== undefined) teamMember.content = content;

      let nextImage = teamMember.image ?? null;
      if (req.file) {
        try {
          const uploaded = await this.uploadImage(req.file);
          if (uploaded) {
            await this.deleteImage(nextImage);
            nextImage = uploaded;
          } else {
            logger.warn(
              "Image upload failed during update, keeping existing image"
            );
          }
        } catch (error: any) {
          logger.error("Error uploading image during update", {
            error: error.message,
            fileName: req.file.originalname,
          });
        }
      } else if (Object.prototype.hasOwnProperty.call(req.body, "image")) {
        const normalized = this.normalizeImageInput(image);
        if (normalized !== nextImage && nextImage) {
          await this.deleteImage(nextImage);
        }
        nextImage = normalized;
      }
      teamMember.image = nextImage ?? null;

      if (requesterId) teamMember.updatedBy = requesterId;

      await teamMember.save();

      // Convert to plain object with proper serialization
      const teamMemberObj = JSON.parse(JSON.stringify(teamMember.toObject()));
      const contentObj = teamMemberObj.content || {};

      // Convert markdown content to HTML for response
      const transformedTeamMember = {
        ...teamMemberObj,
        content: markdownI18nToHtml(
          contentObj as Record<string, string | null | undefined>
        ),
      };

      res.apiSuccess(
        { teamMember: transformedTeamMember },
        "Team member updated successfully"
      );
    }
  );

  /**
   * Delete team member (soft delete)
   */
  deleteTeamMember = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const teamMember = await TeamMembers.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!teamMember) {
        throw new AppError("Team member not found", 404);
      }

      if (teamMember.image) {
        await this.deleteImage(teamMember.image);
        teamMember.image = null;
      }
      teamMember.isDeleted = true;
      teamMember.deletedAt = new Date();
      await teamMember.save();

      res.apiSuccess(null, "Team member deleted successfully");
    }
  );
}

export const adminTeamMemberController = new AdminTeamMemberController();
