import { XMLParser } from "fast-xml-parser";
import { logger } from "./logger";

/**
 * XML Parser Utility
 * Parses PostNL Delivery Order Response XML
 */

interface DeliveryOrderResponse {
  orderNo: string;
  trackAndTraceCode: string;
  status?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: false,
  trimValues: true,
} as any);

/**
 * Parse XML string to JavaScript object
 */
export function parseXML(xmlString: string): DeliveryOrderResponse {
  try {
    const result = parser.parse(xmlString);

    // Extract data from parsed XML structure
    const orderStatus =
      result.deliveryOrderResponse?.orderStatus ||
      result.orderStatusResponse?.orderStatus ||
      result.orderStatus;

    if (!orderStatus) {
      throw new Error("Invalid XML structure: orderStatus not found");
    }

    const response: DeliveryOrderResponse = {
      orderNo:
        orderStatus.orderNo?.["#text"] ||
        orderStatus.orderNo ||
        orderStatus.orderNo?._ ||
        "",
      trackAndTraceCode:
        orderStatus.trackAndTraceCode?.["#text"] ||
        orderStatus.trackAndTraceCode ||
        orderStatus.trackAndTraceCode?._ ||
        "",
      status:
        orderStatus.status?.["#text"] ||
        orderStatus.status ||
        orderStatus.status?._,
    };

    return response;
  } catch (error: any) {
    logger.error(`XML parsing error: ${error.message}`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
