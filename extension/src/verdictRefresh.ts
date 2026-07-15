import type { ReviewerVerdict } from "./reviewerVerdict.js";

export async function refreshVerdict(
  rootPath: string,
  load: (rootPath: string) => Promise<ReviewerVerdict | undefined>,
  set: (verdict: ReviewerVerdict | undefined) => void,
  emit: () => void,
): Promise<void> {
  try {
    set(await load(rootPath));
  } catch {
    set(undefined);
  }
  emit();
}
