/**
 * SMS Service (Infobip) – V1-compatible
 *
 * Used for sending SMS when shipment is at pickup point (AT_PICKUP_POINT).
 * Message language = user's selected language in profile (User.language).
 * Config: INFOBIP_URL, INFOBIP_API_KEY (same as backend-master config.yml).
 */

import { logger } from "@/utils/logger";
import type { SupportedLanguage } from "@/models/common.model";
import { config } from "@/config";

const INFOBIP_URL = config.infobip.url;
const INFOBIP_API_KEY = config.infobip.apiKey;
const SMS_FROM = config.sms.from;

/** E.164-ish: ensure number has country code for Infobip (V1 uses libphonenumber) */
function normalizePhone(phone: string, countryCode: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return phone;
  const ccMap: Record<string, string> = {
    NL: "31",
    BE: "32",
    DE: "49",
    FR: "33",
  };
  const cc = ccMap[countryCode?.toUpperCase()] || "31";
  if (digits.startsWith(cc) && digits.length > cc.length) return digits;
  if (digits.startsWith("0")) return cc + digits.slice(1);
  if (digits.length <= 10) return cc + digits;
  return digits;
}

/** Pickup-point SMS message by user language (V2: from User.language) */
function getPickupMessage(
  lang: SupportedLanguage,
  firstName: string,
  trackingUrl: string
): string {
  const name = firstName?.trim() || "there";
  const messages: Record<SupportedLanguage, string> = {
    en: `Hi ${name}, your Viteezy package is at a PostNL pickup point; they missed you. See: ${trackingUrl}`,
    nl: `Hi ${name}, je Viteezy pakket is bij een PostNL punt, ze hebben je helaas gemist. Zie: ${trackingUrl}`,
    de: `Hi ${name}, dein Viteezy-Paket liegt bei einer PostNL-Abholstelle, sie haben dich leider verpasst. Siehe: ${trackingUrl}`,
    fr: `Bonjour ${name}, votre colis Viteezy est dans un point PostNL, ils vous ont manqué. Voir: ${trackingUrl}`,
    es: `Hola ${name}, tu paquete Viteezy está en un punto de recogida PostNL, te perdieron. Ver: ${trackingUrl}`,
  };
  return messages[lang] ?? messages.en;
}

export interface SendPickupSmsParams {
  toPhone: string;
  countryCode: string;
  firstName: string;
  trackingUrl: string;
  orderNumber?: string;
  /** User's preferred language (from User.language → en/nl/de/fr/es). Defaults to "en". */
  language?: SupportedLanguage;
}

/**
 * Send "at pickup point" SMS in the user's selected language.
 * Skips send if INFOBIP_API_KEY is not set (logs and returns).
 */
export async function sendPickupPointSms(params: SendPickupSmsParams): Promise<boolean> {
  const { toPhone, countryCode, firstName, trackingUrl, language = "en" } = params;

  if (
    !INFOBIP_API_KEY?.trim() ||
    !INFOBIP_URL?.trim() ||
    !SMS_FROM?.trim()
  ) {
    logger.warn(
      "SMS skipped: set INFOBIP_URL, INFOBIP_API_KEY, and SMS_FROM to enable pickup notifications."
    );
    return false;
  }

  if (!toPhone || !trackingUrl) {
    logger.warn("SMS skipped: missing phone or trackingUrl", {
      hasPhone: !!toPhone,
      hasTrackingUrl: !!trackingUrl,
    });
    return false;
  }

  const to = normalizePhone(toPhone, countryCode || "NL");
  const message = getPickupMessage(language, firstName, trackingUrl);

  const url = `${INFOBIP_URL.replace(/\/$/, "")}/sms/2/text/advanced`;
  const body = {
    messages: [
      {
        from: SMS_FROM,
        destinations: [{ to }],
        text: message,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `App ${INFOBIP_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("Infobip SMS request failed", {
        status: response.status,
        statusText: response.statusText,
        body: text?.substring(0, 500),
      });
      return false;
    }

    const data = (await response.json()) as { messages?: Array< { status?: { groupName?: string } }> };
    const status = data?.messages?.[0]?.status?.groupName;
    if (status && status !== "PENDING" && status !== "ACCEPTED") {
      logger.warn("Infobip SMS reported non-success status", { status, data });
    }
    logger.info("Pickup point SMS sent via Infobip", {
      to: to.substring(0, 4) + "***",
      orderNumber: params.orderNumber,
    });
    return true;
  } catch (error: any) {
    logger.error("Failed to send pickup point SMS", {
      error: error?.message,
      stack: error?.stack,
    });
    return false;
  }
}
