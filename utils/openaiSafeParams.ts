export function stripUnsupportedParams<T extends Record<string, any>>(params: T): T {
  const { temperature, ...rest } = params;
  return rest as T;
}
