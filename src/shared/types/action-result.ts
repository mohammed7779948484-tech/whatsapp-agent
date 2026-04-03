export type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type AsyncActionResult<T = void> = Promise<ActionResult<T>>;

export function success<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function failure(error: string, code?: string): ActionResult<never> {
  return { success: false, error, code };
}