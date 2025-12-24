import mongoose, { FilterQuery } from "mongoose";
import { FAQs, IFAQ } from "@/models/cms/faqs.model";
import { FaqCategories, IFaqCategory } from "@/models/cms/faqCategories.model";
import {
  I18nStringType,
  I18nTextType,
  SupportedLanguage,
} from "@/models/common.model";
import { FAQStatus } from "@/models/enums";
type LeanFaqCategory = IFaqCategory & { _id: mongoose.Types.ObjectId };
type LeanFaq = IFAQ & { _id: mongoose.Types.ObjectId };

export interface GetFaqsFilters {
  search?: string;
  category?: string;
  lang?: SupportedLanguage;
}

interface GroupedFaqItem {
  _id: string;
  question: string;
  answer: string;
}

export interface GroupedFaqResponse {
  categoryId: string | null;
  categoryTitle: string;
  categorySlug: string | null;
  faqs: GroupedFaqItem[];
}

class FaqService {
  private readonly fallbackCategoryTitle = "General";

  async getFaqsGrouped(
    filters: GetFaqsFilters = {}
  ): Promise<GroupedFaqResponse[]> {
    const lang: SupportedLanguage = (filters.lang || "en") as SupportedLanguage;
    const faqFilter: FilterQuery<IFAQ> = {
      isDeleted: false,
      $or: [
        { status: FAQStatus.ACTIVE },
        { status: { $exists: false }, isActive: { $ne: false } },
      ],
    };

    const andClauses: FilterQuery<IFAQ>[] = [];

    if (filters.search) {
      const regex = this.buildRegex(filters.search);
      andClauses.push({
        $or: [
          { [`question.${lang}`]: regex },
          { "question.en": regex },
          { [`answer.${lang}`]: regex },
          { "answer.en": regex },
        ],
      });
    }

    if (filters.category) {
      const categoryValue = filters.category.trim();
      if (mongoose.Types.ObjectId.isValid(categoryValue)) {
        faqFilter.categoryId = new mongoose.Types.ObjectId(categoryValue);
      } else {
        const regex = this.buildRegex(categoryValue);
        const matchedCategories = await FaqCategories.find({
          isDeleted: false,
          $or: [
            { "title.en": regex },
            { "title.nl": regex },
            { "title.de": regex },
            { "title.fr": regex },
            { "title.es": regex },
          ],
        })
          .select("_id")
          .lean();

        if (matchedCategories.length > 0) {
          faqFilter.categoryId = {
            $in: matchedCategories.map((category) => category._id),
          };
        } else {
          andClauses.push({ category: regex });
        }
      }
    }

    if (andClauses.length) {
      faqFilter.$and = andClauses;
    }

    const [categories, faqs] = await Promise.all([
      this.fetchCategories({ onlyActive: true }),
      FAQs.find(faqFilter).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    ]);

    return this.groupFaqsByCategory(
      categories,
      faqs as unknown as LeanFaq[],
      lang
    );
  }

  async getCategories({
    lang = "en",
    status = "active",
    title,
  }: {
    lang?: SupportedLanguage;
    status?: "active" | "all";
    title?: string;
  } = {}) {
    const onlyActive = status !== "all";
    const categories = await this.fetchCategories({ onlyActive, title });

    return categories.map((category) => ({
      _id: category._id.toString(),
      title: this.resolveI18nField(category.title, lang),
      isActive: category.isActive,
      slug: category.slug || null,
      icon: category.icon || null,
    }));
  }

  private async fetchCategories({
    onlyActive,
    title,
  }: {
    onlyActive: boolean;
    title?: string;
  }): Promise<LeanFaqCategory[]> {
    const filter: FilterQuery<IFaqCategory> = { isDeleted: false };
    if (onlyActive) {
      filter.isActive = true;
    }

    // Add title search filter if provided
    if (title && title.trim()) {
      const titleRegex = this.buildRegex(title.trim());
      filter.$or = [
        { "title.en": titleRegex },
        { "title.nl": titleRegex },
        { "title.de": titleRegex },
        { "title.fr": titleRegex },
        { "title.es": titleRegex },
        { slug: titleRegex },
      ];
    }

    return (await FaqCategories.find(filter)
      .sort({ createdAt: 1 })
      .lean()) as unknown as LeanFaqCategory[];
  }

  private groupFaqsByCategory(
    categories: LeanFaqCategory[],
    faqs: LeanFaq[],
    lang: SupportedLanguage
  ): GroupedFaqResponse[] {
    if (!faqs.length) {
      return [];
    }

    const categoryOrder = categories.map((category) => category._id.toString());
    const grouped = new Map<string, GroupedFaqResponse>();
    const fallbackKeys: string[] = [];

    categories.forEach((category) => {
      const key = category._id.toString();
      grouped.set(key, {
        categoryId: key,
        categoryTitle:
          this.resolveI18nField(category.title, lang) ||
          this.fallbackCategoryTitle,
        categorySlug: category.slug || null,
        faqs: [],
      });
    });

    faqs.forEach((faq) => {
      const formattedFaq: GroupedFaqItem = {
        _id: faq._id.toString(),
        question: this.resolveI18nField(faq.question, lang),
        answer: this.resolveI18nField(faq.answer, lang),
      };

      if (faq.categoryId) {
        const key = faq.categoryId.toString();
        const categoryGroup = grouped.get(key);
        if (categoryGroup) {
          categoryGroup.faqs.push(formattedFaq);
          return;
        }
      }

      const fallbackKey =
        faq.category?.toLowerCase()?.trim() || "__uncategorized";

      if (!grouped.has(fallbackKey)) {
        grouped.set(fallbackKey, {
          categoryId: faq.categoryId ? faq.categoryId.toString() : null,
          categoryTitle: faq.category || this.fallbackCategoryTitle,
          categorySlug: this.slugify(faq.category),
          faqs: [],
        });
        fallbackKeys.push(fallbackKey);
      }

      grouped.get(fallbackKey)!.faqs.push(formattedFaq);
    });

    const orderedGroups: GroupedFaqResponse[] = [];

    categoryOrder.forEach((key) => {
      const group = grouped.get(key);
      if (group && group.faqs.length > 0) {
        orderedGroups.push(group);
      }
    });

    fallbackKeys.forEach((key) => {
      const group = grouped.get(key);
      if (group && group.faqs.length > 0) {
        orderedGroups.push(group);
      }
    });

    return orderedGroups;
  }

  private resolveI18nField(
    field: I18nStringType | I18nTextType | undefined,
    lang: SupportedLanguage
  ): string {
    if (!field) {
      return "";
    }

    if (typeof field === "string") {
      return field;
    }

    return (
      field[lang] ||
      field.en ||
      field.nl ||
      Object.values(field).find(Boolean) ||
      ""
    );
  }

  private slugify(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private buildRegex(value: string): RegExp {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, "i");
  }
}

export const faqService = new FaqService();
