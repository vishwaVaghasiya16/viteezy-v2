import fetch, { Response } from "node-fetch";
import { config } from "@/config";
import { logger } from "@/utils/logger";

export interface PostNLAddressRequest {
  postcode: string;
  houseNumber: string;
  houseNumberAddition?: string;
  countryCode?: string;
}

export interface PostNLNormalizedAddress {
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  houseNumber?: string;
  houseNumberAddition?: string;
}

export interface PostNLAddressValidationResult {
  isValid: boolean;
  source: "postnl" | "skipped";
  reason?: string;
  normalizedAddress?: PostNLNormalizedAddress;
  raw?: unknown;
}

export class PostNLServiceError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = "PostNLServiceError";
  }
}

interface PostNLServiceOptions {
  addressValidationUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class PostNLService {
  private readonly url: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly isConfigured: boolean;

  constructor(options: PostNLServiceOptions = {}) {
    this.url =
      options.addressValidationUrl ?? config.postnl.addressValidationUrl;
    this.apiKey = options.apiKey ?? config.postnl.apiKey;
    this.timeoutMs = options.timeoutMs ?? config.postnl.timeoutMs;
    this.isConfigured = Boolean(this.url && this.apiKey);

    if (!this.isConfigured) {
      logger.warn(
        "PostNL address validation is disabled. Missing POSTNL_URL or POSTNL_API_KEY environment variables."
      );
    }
  }

  async validateAddress(
    request: PostNLAddressRequest
  ): Promise<PostNLAddressValidationResult> {
    const { sanitized, apiPayload } = this.buildPayload(request);

    if (!this.isConfigured) {
      logger.debug("Skipping PostNL validation (service not configured)", {
        payload: sanitized,
      });

      return {
        isValid: true,
        source: "skipped",
        normalizedAddress: {
          postcode: sanitized.postcode,
          houseNumber: sanitized.houseNumber,
          houseNumberAddition: sanitized.houseNumberAddition,
        },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          apikey: this.apiKey,
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(apiPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const body = await this.parseResponse(response);
      const result = this.mapResponse(body);

      if (!result.isValid) {
        logger.warn("PostNL rejected address", {
          payload: sanitized,
          response: body,
        });
      }

      return result;
    } catch (error: any) {
      clearTimeout(timeout);

      if (error?.name === "AbortError") {
        throw new PostNLServiceError("PostNL request timed out", {
          timeoutMs: this.timeoutMs,
        });
      }

      logger.error("PostNL validation failed", {
        error: error?.message ?? error,
        payload: sanitized,
      });

      throw new PostNLServiceError(
        "Failed to validate address with PostNL",
        error
      );
    }
  }

  private buildPayload(request: PostNLAddressRequest): {
    sanitized: PostNLAddressRequest;
    apiPayload: Record<string, string>;
  } {
    const sanitizedPostcode = request.postcode
      .replace(/\s+/g, "")
      .toUpperCase();
    const houseNumber = String(request.houseNumber).trim();
    const houseNumberAddition = request.houseNumberAddition
      ? request.houseNumberAddition.trim()
      : undefined;
    const countryCode = (request.countryCode || "NL").toUpperCase();

    const sanitizedPayload: PostNLAddressRequest = {
      postcode: sanitizedPostcode,
      houseNumber,
      ...(houseNumberAddition ? { houseNumberAddition } : {}),
      countryCode,
    };

    const apiPayload: Record<string, string> = {
      postalCode: sanitizedPostcode,
      PostalCode: sanitizedPostcode,
      Postcode: sanitizedPostcode,
      houseNumber,
      HouseNumber: houseNumber,
      CountryIso: countryCode,
    };

    if (houseNumberAddition) {
      apiPayload.Addition = houseNumberAddition;
      apiPayload.AdditionNumber = houseNumberAddition;
      apiPayload.HouseNumberAddition = houseNumberAddition;
    }

    return { sanitized: sanitizedPayload, apiPayload };
  }

  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text();

    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (error) {
      logger.error("Failed to parse PostNL response body", {
        error,
        body: text,
      });
    }

    if (!response.ok) {
      throw new PostNLServiceError(
        `PostNL responded with status ${response.status}`,
        parsed || text
      );
    }

    return parsed;
  }

  private mapResponse(data: any): PostNLAddressValidationResult {
    if (Array.isArray(data)) {
      const first = data[0];
      return {
        isValid: Boolean(first),
        normalizedAddress: first ? this.normalizeAddress(first) : undefined,
        raw: data,
        source: "postnl",
      };
    }

    const indicator = this.extractIndicator(data);
    const isValid =
      typeof indicator === "boolean"
        ? indicator
        : typeof indicator === "string"
        ? indicator.toLowerCase() === "valid"
        : Boolean(data?.isValid ?? data?.Valid ?? data);

    const reason =
      data?.reason ||
      data?.Reason ||
      data?.errorMessage ||
      data?.ErrorMessage ||
      data?.message;

    return {
      isValid,
      reason,
      normalizedAddress: this.normalizeAddress(data),
      raw: data,
      source: "postnl",
    };
  }

  private extractIndicator(data: any): boolean | string | undefined {
    if (typeof data?.isValid === "boolean") {
      return data.isValid;
    }

    return (
      data?.validationStatus ||
      data?.ValidationResultIndicator ||
      data?.ValidationStatus ||
      data?.result ||
      data?.ResultIndicator
    );
  }

  private normalizeAddress(data: any): PostNLNormalizedAddress | undefined {
    if (!data) {
      return undefined;
    }

    return {
      street:
        data?.street ||
        data?.Street ||
        data?.ValidatedAddress?.Street ||
        data?.Address?.Street ||
        data?.FormattedAddress?.[0],
      city:
        data?.city ||
        data?.City ||
        data?.ValidatedAddress?.City ||
        data?.Address?.City ||
        data?.CityName,
      state:
        data?.state ||
        data?.State ||
        data?.Province ||
        data?.ValidatedAddress?.Province ||
        data?.ProvinceName,
      postcode:
        data?.postcode ||
        data?.PostalCode ||
        data?.ValidatedAddress?.PostalCode ||
        data?.Zipcode,
      houseNumber:
        data?.houseNumber ||
        data?.HouseNumber ||
        data?.ValidatedAddress?.HouseNumber,
      houseNumberAddition:
        data?.houseNumberAddition ||
        data?.HouseNumberSuffix ||
        data?.ValidatedAddress?.HouseNumberSuffix ||
        data?.Addition,
    };
  }
}

export const postNLService = new PostNLService();
