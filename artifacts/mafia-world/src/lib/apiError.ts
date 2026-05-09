export function getApiError(err: unknown, fallback = "An error occurred"): string {
  if (typeof err === "object" && err !== null && "data" in err) {
    const data = (err as { data: unknown }).data;
    if (typeof data === "object" && data !== null && "error" in data) {
      const msg = (data as { error: unknown }).error;
      if (typeof msg === "string") return msg;
    }
  }
  return fallback;
}
