export function isNewer(candidate: string, current: string): boolean {
  const release = (version: string) => version.split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
  const [a, b] = [release(candidate), release(current)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);

  // Same release: a final beats the prerelease that led to it, and two prereleases fall back
  // to string order, which is right for the -rc.1 / -rc.2 shape this project actually uses.
  const [pre, currentPre] = [candidate.split('-')[1], current.split('-')[1]];
  if (pre === currentPre) return false;
  if (!pre) return true;
  if (!currentPre) return false;
  return pre > currentPre;
}
