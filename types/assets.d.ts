/** Deklarasi modul asset Metro: font TTF → asset registry number. */
declare module "*.ttf" {
  const asset: number;
  export default asset;
}

/** CSS side-effect import (NativeWind v5). */
declare module "*.css";
