/**
 * @fileoverview Family Linking Safety Utilities
 * @description Production safety utilities for Family Linking System
 * @module utils/familyLinkingSafety
 */

import { AppError } from "./AppError";
import { logger } from "./logger";

/**
 * Check if error is a duplicate key error
 * @function isDuplicateKeyError
 * @param error - Error to check
 * @returns boolean - True if duplicate key error
 */
export function isDuplicateKeyError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const errorCode = error.code || error.codeName;
  
  // MongoDB duplicate key error codes
  return (
    errorCode === 11000 || // MongoDB duplicate key error code
    errorCode === 11001 || // MongoDB duplicate key error code (legacy)
    errorMessage.includes('duplicate key') ||
    errorMessage.includes('E11000') ||
    errorMessage.includes('E11001')
  );
}

/**
 * Check if error is a transaction error
 * @function isTransactionError
 * @param error - Error to check
 * @returns boolean - True if transaction error
 */
export function isTransactionError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  
  return (
    errorMessage.includes('Transaction') ||
    errorMessage.includes('transaction') ||
    errorMessage.includes('WriteConflict') ||
    errorMessage.includes('NoSuchTransaction')
  );
}

/**
 * Handle database operation with retry logic for duplicate key errors
 * @function handleDuplicateKeyGracefully
 * @param error - Error to handle
 * @param context - Operation context for logging
 * @returns boolean - True if error was handled gracefully (should not be re-thrown)
 */
export function handleDuplicateKeyGracefully(error: any, context: any): boolean {
  if (isDuplicateKeyError(error)) {
    logger.info("Duplicate key error handled gracefully (idempotent operation)", {
      ...context,
      errorMessage: error.message,
      errorCode: error.code
    });
    return true; // Error handled gracefully, don't re-throw
  }
  return false; // Not a duplicate key error, should be re-thrown
}

/**
 * Create a safe transaction context with proper error handling
 * @function createTransactionContext
 * @param operationName - Name of the operation
 * @param additionalContext - Additional context data
 * @returns object - Transaction context object
 */
export function createTransactionContext(operationName: string, additionalContext: any = {}): any {
  const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    transactionId,
    operationName,
    timestamp: new Date().toISOString(),
    ...additionalContext
  };
}

/**
 * Log transaction lifecycle events
 * @function logTransactionEvent
 * @param event - Event type (started, committed, rolled_back)
 * @param context - Transaction context
 * @param additionalData - Additional data to log
 */
export function logTransactionEvent(event: string, context: any, additionalData: any = {}): void {
  const logLevel = event === 'rolled_back' ? 'error' : 'info';
  const message = `Transaction ${event}: ${context.operationName}`;
  
  logger[logLevel](message, {
    ...context,
    event,
    ...additionalData
  });
}

/**
 * Validate MongoDB session is active and valid
 * @function validateSession
 * @param session - MongoDB session
 * @throws AppError if session is invalid
 */
export function validateSession(session: any): void {
  if (!session) {
    throw new AppError("Database session is required for transaction", 500, true, "MISSING_SESSION");
  }
  
  if (session.inTransaction && !session.transaction.isActive) {
    throw new AppError("Transaction session is not active", 500, true, "INACTIVE_TRANSACTION");
  }
}

/**
 * Safely abort transaction with proper error handling
 * @function safeAbortTransaction
 * @param session - MongoDB session
 * @param context - Operation context
 * @param reason - Reason for aborting
 */
export async function safeAbortTransaction(session: any, context: any, reason?: string): Promise<void> {
  try {
    if (session && session.inTransaction) {
      await session.abortTransaction();
      logTransactionEvent('rolled_back', context, { reason });
    }
  } catch (abortError) {
    logger.error("Failed to abort transaction", {
      ...context,
      abortError: (abortError as Error).message,
      originalReason: reason
    });
  }
}

/**
 * Safely commit transaction with proper error handling
 * @function safeCommitTransaction
 * @param session - MongoDB session
 * @param context - Operation context
 */
export async function safeCommitTransaction(session: any, context: any): Promise<void> {
  try {
    if (session && session.inTransaction) {
      await session.commitTransaction();
      logTransactionEvent('committed', context);
    }
  } catch (commitError) {
    logger.error("Failed to commit transaction", {
      ...context,
      commitError: (commitError as Error).message
    });
    await safeAbortTransaction(session, context, 'Commit failed');
    throw commitError;
  }
}

/**
 * Enhanced error information for production debugging
 * @function enhanceErrorInfo
 * @param error - Original error
 * @param context - Operation context
 * @returns object - Enhanced error information
 */
export function enhanceErrorInfo(error: any, context: any): any {
  return {
    message: error.message,
    name: error.name,
    code: error.code,
    codeName: error.codeName,
    isDuplicateKey: isDuplicateKeyError(error),
    isTransactionError: isTransactionError(error),
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };
}
