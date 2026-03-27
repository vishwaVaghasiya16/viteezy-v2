/**
 * @fileoverview Family Events System
 * @description Lightweight event system for family management actions
 * @module utils/familyEvents
 */

import { EventEmitter } from "events";
import { logger } from "./logger";

// ============================================================================
// EVENT CONSTANTS
// ============================================================================

export const FAMILY_EVENTS = {
  MEMBER_LINKED: "FAMILY_MEMBER_LINKED",
  MEMBER_REMOVED: "FAMILY_MEMBER_REMOVED",
  MEMBER_LEFT: "FAMILY_MEMBER_LEFT",
  ORDER_PLACED: "ORDER_PLACED",
  ADDRESS_RESOLVED: "ADDRESS_RESOLVED",
  CONTEXT_SWITCHED: "CONTEXT_SWITCHED",
  ITEM_ADDED_TO_CART: "ITEM_ADDED_TO_CART",
  RECOMMENDATION_FETCHED: "RECOMMENDATION_FETCHED",
} as const;

// ============================================================================
// EVENT INTERFACES
// ============================================================================

export interface FamilyMemberLinkedEvent {
  mainMemberId: string;
  subMemberId: string;
  relationshipToParent?: string;
  actionBy: string;
  timestamp: Date;
}

export interface FamilyMemberRemovedEvent {
  mainMemberId: string;
  subMemberId: string;
  actionBy: string;
  timestamp: Date;
}

export interface FamilyMemberLeftEvent {
  subMemberId: string;
  mainMemberId: string;
  actionBy: string;
  timestamp: Date;
}

export interface OrderPlacedEvent {
  orderedBy: string;
  orderedFor: string;
  relationshipType: "SELF" | "FAMILY";
  orderId: string;
  orderNumber: string;
  timestamp: Date;
}

export interface AddressResolvedEvent {
  orderedBy: string;
  orderedFor: string;
  source: "SELF" | "INHERITED" | "MANUAL";
  inheritedFrom?: string;
  addressId?: string;
  timestamp: Date;
}

export interface ContextSwitchedEvent {
  selectedBy: string;
  oldProfileId?: string;
  newProfileId: string;
  relationshipType: "SELF" | "FAMILY";
  timestamp: Date;
}

export interface ItemAddedToCartEvent {
  userId: string;
  profileId: string;
  productId: string;
  variantType: string;
  quantity: number;
  timestamp: Date;
}

export interface RecommendationFetchedEvent {
  selectedBy: string;
  profileId: string;
  recommendationCount: number;
  criteria: any;
  timestamp: Date;
}

export type FamilyEvent = 
  | FamilyMemberLinkedEvent
  | FamilyMemberRemovedEvent
  | FamilyMemberLeftEvent
  | OrderPlacedEvent
  | AddressResolvedEvent
  | ContextSwitchedEvent
  | ItemAddedToCartEvent
  | RecommendationFetchedEvent;

// ============================================================================
// EVENT EMITTER
// ============================================================================

class FamilyEventEmitter extends EventEmitter {
  /**
   * Emit a family event (async fire-and-forget pattern)
   * @param event - Event type
   * @param data - Event data
   */
  async emitFamilyEvent(event: string, data: FamilyEvent): Promise<void> {
    try {
      // Emit event asynchronously without waiting for listeners
      setImmediate(() => {
        this.emit(event, data);
      });

      // Log event emission
      logger.info("Family event emitted", {
        event,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Log error but don't throw - events should not block main flow
      logger.error("Failed to emit family event", {
        event,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const familyEventEmitter = new FamilyEventEmitter();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Emit family member linked event
 */
export const emitFamilyMemberLinked = async (data: FamilyMemberLinkedEvent): Promise<void> => {
  await familyEventEmitter.emitFamilyEvent(FAMILY_EVENTS.MEMBER_LINKED, data);
};

/**
 * Emit family member removed event
 */
export const emitFamilyMemberRemoved = async (data: FamilyMemberRemovedEvent): Promise<void> => {
  await familyEventEmitter.emitFamilyEvent(FAMILY_EVENTS.MEMBER_REMOVED, data);
};

/**
 * Emit family member left event
 */
export const emitFamilyMemberLeft = async (data: FamilyMemberLeftEvent): Promise<void> => {
  await familyEventEmitter.emitFamilyEvent(FAMILY_EVENTS.MEMBER_LEFT, data);
};

/**
 * Add event listener for family events
 */
export const onFamilyEvent = (
  event: string,
  listener: (data: FamilyEvent) => void
): void => {
  familyEventEmitter.on(event, listener);
};

/**
 * Remove event listener for family events
 */
export const offFamilyEvent = (
  event: string,
  listener: (data: FamilyEvent) => void
): void => {
  familyEventEmitter.off(event, listener);
};
