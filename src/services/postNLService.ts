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
    const { sanitized, queryParams } = this.buildPayload(request);

    if (!this.isConfigured) {
      logger.warn("PostNL validation service not configured", {
        payload: sanitized,
      });

      // Throw error instead of skipping - validation is mandatory
      throw new PostNLServiceError(
        "PostNL address validation service is not configured. Please set POSTNL_API_KEY environment variable.",
        { configured: false }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Build URL with query parameters (v2 API uses GET method)
      const queryString = new URLSearchParams(
        Object.entries(queryParams).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();

      const urlWithParams = `${this.url}?${queryString}`;

      const response = await fetch(urlWithParams, {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: this.apiKey,
        },
        signal: controller.signal,
      });

      logger.debug("PostNL API v2 request", {
        url: urlWithParams,
        queryParams,
        status: response.status,
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
    queryParams: Record<string, string>;
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

    // PostNL API v2 benelux endpoint uses GET with query parameters
    const queryParams: Record<string, string> = {
      countryIso: countryCode,
      houseNumber: houseNumber,
    };

    // Add optional parameters if provided
    if (sanitizedPostcode) {
      queryParams.postalCode = sanitizedPostcode;
    }

    if (houseNumberAddition) {
      queryParams.houseNumberAddition = houseNumberAddition;
      // For Belgium, also use 'bus' parameter
      if (countryCode === "BE") {
        queryParams.bus = houseNumberAddition;
      }
    }

    return { sanitized: sanitizedPayload, queryParams };
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
      const error = new PostNLServiceError(
        `PostNL responded with status ${response.status}`,
        { status: response.status, body: parsed || text }
      );
      // Attach status code for easier error handling
      (error as any).status = response.status;
      throw error;
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

    // PostNL v2 API response structure
    return {
      street:
        data?.streetName || data?.StreetName || data?.street || data?.Street,
      city:
        data?.cityName ||
        data?.CityName ||
        data?.city ||
        data?.City ||
        data?.localityName ||
        data?.LocalityName,
      state:
        data?.stateName ||
        data?.StateName ||
        data?.state ||
        data?.State ||
        data?.province ||
        data?.Province,
      postcode:
        data?.postalCode ||
        data?.PostalCode ||
        data?.postcode ||
        data?.Postcode,
      houseNumber:
        data?.houseNumber ||
        data?.HouseNumber ||
        String(data?.houseNumber || ""),
      houseNumberAddition:
        data?.houseNumberAddition ||
        data?.HouseNumberAddition ||
        data?.bus ||
        data?.Bus,
    };
  }
}

export const postNLService = new PostNLService();
