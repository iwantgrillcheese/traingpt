// /types/next.d.ts
declare module 'next' {
  export type PageProps<T extends Record<string, string> = {}> = {
    params: T;
    searchParams?: Record<string, string | string[] | undefined>;
  };
}
