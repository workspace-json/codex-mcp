/**
 * Load a reviewer artifact off the single refresh path and emit exactly once,
 * whether the load succeeds or fails. Generic over the loaded value so the same
 * transaction shape serves both the raw verdict and the validated receipt load.
 * On failure the caller supplies the value to fall back to (e.g. "no run"),
 * because a failed discovery must still leave a well-formed state, never a
 * half-updated one.
 */
export async function refreshVerdict<T>(
  rootPath: string,
  load: (rootPath: string) => Promise<T>,
  set: (value: T) => void,
  emit: () => void,
  onError: (error: unknown) => T,
): Promise<void> {
  try {
    set(await load(rootPath));
  } catch (error) {
    set(onError(error));
  }
  emit();
}
