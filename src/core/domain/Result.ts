/**
 * Pattern: Functional Result
 * Skill: typescript-advanced-types
 * 
 * Provides a type-safe way to handle success and failure without exceptions.
 */

export type Result<T, E = string> = 
  | { success: true; data: T; error?: never }
  | { success: false; error: E; data?: never };

export const Result = {
  ok: <T>(data: T): Result<T, never> => ({ success: true, data }),
  fail: <E>(error: E): Result<never, E> => ({ success: false, error }),
};

/**
 * Utility for Server Actions to maintain compatibility with existing components
 * while using the new Result pattern internally.
 */
export interface ActionResult<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}
