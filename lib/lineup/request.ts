/** Bound database/storage waits as well as provider requests. */
export const lineupFetch: typeof fetch = (input, init = {}) => {
  const upstream =
    init.signal ?? (input instanceof Request ? input.signal : undefined);
  const timeout = AbortSignal.timeout(20_000);
  return fetch(input, {
    ...init,
    signal: upstream ? AbortSignal.any([upstream, timeout]) : timeout,
  });
};
