/** Wait for every in-flight upload before yielding the lease, including on failure. */
export async function copyMockupChunk<T, R>(items: T[], start: number, copy: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = await Promise.allSettled(items.slice(start, start + 3).map((item, offset) => copy(item, start + offset)));
  const failed = results.find(result => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return results.map(result => (result as PromiseFulfilledResult<R>).value);
}
