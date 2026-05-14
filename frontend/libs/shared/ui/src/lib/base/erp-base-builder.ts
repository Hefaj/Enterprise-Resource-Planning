export abstract class ErpBaseBuilder<T> {
  protected _data: Partial<T> = {};

  /**
   * @internal Metoda używana tylko wewnętrznie przez klasę bazową.
   * Nie używaj jej w widokach komponentów!
   */
  public build(): T {
    return this._data as T;
  }

  /**
   * Pomocnik do wyciągania danych z Buildera lub bezpośredniego obiektu.
   * Ułatwia zagnieżdżanie builderów.
   */
  protected _extract(val: any): any {
    if (!val) return val;

    // Jeśli sam obiekt jest builderem
    if (typeof val === 'object' && 'build' in val && typeof val.build === 'function') {
      return val.build();
    }

    // Jeśli obiekt ma właściwości, które są builderami (np. { config: builder })
    if (typeof val === 'object' && !Array.isArray(val)) {
      const extracted: any = {};
      let hasBuilder = false;

      for (const key in val) {
        const item = val[key];
        if (item && typeof item === 'object' && 'build' in item && typeof item.build === 'function') {
          extracted[key] = item.build();
          hasBuilder = true;
        } else {
          extracted[key] = item;
        }
      }
      return hasBuilder ? extracted : val;
    }

    return val;
  }

  public static create<TBuilder extends ErpBaseBuilder<any>>(this: new () => TBuilder, configure?: (builder: TBuilder) => void): ReturnType<TBuilder['build']> {
    const builder = new this();
    configure?.(builder);
    return builder.build();
  }
}
