/**
 * Component: TypeDefinitions
 * Type definitions re-exported from shared contracts
 * @contract renders: Document, Block, Basket, ContextItem, Dump
 */
// Re-export from shared contracts for backward compatibility
export * from "@/shared/contracts";

// Legacy exports for compatibility
export type { Document } from "@/shared/contracts/documents";
export type { Block, BlockWithHistory } from "@/shared/contracts/blocks";
export type { Basket } from "@/shared/contracts/baskets";
export type { Dump, RawDump } from "@/shared/contracts/dumps";
