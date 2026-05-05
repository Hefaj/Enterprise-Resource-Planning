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
  protected _extract<TC>(value: TC | { build: () => TC } | undefined): TC | undefined {
    if (value && typeof value === 'object' && 'build' in value && typeof value.build === 'function') {
      return value.build();
    }
    return value as TC;
  }

  public static create<TBuilder extends ErpBaseBuilder<any>>(
    this: new () => TBuilder,
    configure: (builder: TBuilder) => void
  ): ReturnType<TBuilder['build']> {
    const builder = new this();
    configure(builder);
    return builder.build();
  }
}
