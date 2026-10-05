/**
 * Stub `react-native` untuk unit test (vitest tanpa jest-preset).
 * Hanya menyediakan yang dipakai kode pure: Platform.
 */
export const Platform = {
  OS: "web" as string,
  select<T>(options: { native?: T; web?: T; default?: T }): T {
    return (options.web ?? options.native ?? options.default) as T;
  },
};

export const AppState = { addEventListener: () => () => null };
