/**
 * XML Builder Utility
 * Builds XML for PostNL Delivery Order Messages
 */

interface DeliveryOrderLine {
  itemNo: string;
  itemDescription: string;
  quantity: number;
}

interface DeliveryOrderData {
  messageNo: string;
  messageDate: string;
  messageTime: string;
  orderNo: string;
  webOrderNo: string;
  orderDate: string;
  orderTime: string;
  customerNo: string;
  onlyHomeAddress: boolean;
  shipToFirstName: string;
  shipToLastName: string;
  shipToStreet: string;
  shipToHouseNo: string;
  shipToAnnex: string;
  shipToPostalCode: string;
  shipToCity: string;
  shipToCountryCode: string;
  shipToPhone: string;
  shipToEmail: string;
  language: string;
  shippingAgentCode: string;
  shipmentType: string;
  deliveryOrderLines: DeliveryOrderLine[];
}

/**
 * Build XML for PostNL Delivery Order Message
 */
export function buildXML(data: DeliveryOrderData): string {
  const linesXML = data.deliveryOrderLines
    .map(
      (line) => `    <deliveryOrderLine>
      <itemNo>${escapeXML(line.itemNo)}</itemNo>
      <itemDescription>${escapeXML(line.itemDescription)}</itemDescription>
      <quantity>${line.quantity}</quantity>
    </deliveryOrderLine>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<deliveryOrderMessage>
  <messageNo>${escapeXML(data.messageNo)}</messageNo>
  <messageDate>${escapeXML(data.messageDate)}</messageDate>
  <messageTime>${escapeXML(data.messageTime)}</messageTime>
  <deliveryOrder>
    <orderNo>${escapeXML(data.orderNo)}</orderNo>
    <webOrderNo>${escapeXML(data.webOrderNo)}</webOrderNo>
    <orderDate>${escapeXML(data.orderDate)}</orderDate>
    <orderTime>${escapeXML(data.orderTime)}</orderTime>
    <customerNo>${escapeXML(data.customerNo)}</customerNo>
    <onlyHomeAddress>${data.onlyHomeAddress}</onlyHomeAddress>
    <shipToFirstName>${escapeXML(data.shipToFirstName)}</shipToFirstName>
    <shipToLastName>${escapeXML(data.shipToLastName)}</shipToLastName>
    <shipToStreet>${escapeXML(data.shipToStreet)}</shipToStreet>
    <shipToHouseNo>${escapeXML(data.shipToHouseNo)}</shipToHouseNo>
    <shipToAnnex>${escapeXML(data.shipToAnnex || "")}</shipToAnnex>
    <shipToPostalCode>${escapeXML(data.shipToPostalCode)}</shipToPostalCode>
    <shipToCity>${escapeXML(data.shipToCity)}</shipToCity>
    <shipToCountryCode>${escapeXML(data.shipToCountryCode)}</shipToCountryCode>
    <shipToPhone>${escapeXML(data.shipToPhone || "")}</shipToPhone>
    <shipToEmail>${escapeXML(data.shipToEmail)}</shipToEmail>
    <language>${escapeXML(data.language)}</language>
    <shippingAgentCode>${escapeXML(data.shippingAgentCode)}</shippingAgentCode>
    <shipmentType>${escapeXML(data.shipmentType)}</shipmentType>
    <deliveryOrderLines>
${linesXML}
    </deliveryOrderLines>
  </deliveryOrder>
</deliveryOrderMessage>`;
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
