const sizeFullNames: Record<string, string> = {
  U: "Universal",
  MS: "Medium Small",
  ML: "Medium Large",
  C: "Compact",
};

export function formatSizeFullName(size: string) {
  return sizeFullNames[size] ?? size;
}
