export async function dal<T>(
  operation: () => Promise<T>
): Promise<T> {
  return operation();
}