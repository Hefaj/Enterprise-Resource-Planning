export abstract class EBaseBuilder<T> {
  protected _data: Partial<T> = {};
  /**
   * @internal Metoda używana tylko wewnętrznie przez klasę bazową.
   * Nie używaj jej w widokach komponentów!
   */
  public build(): T {
    return this._data as T;
  }

  public static create<TBuilder extends EBaseBuilder<ReturnType<TBuilder['build']>>>(
    this: new () => TBuilder,
    configure: (builder: TBuilder) => void,
  ): ReturnType<TBuilder['build']> {
    const builder = new this();
    configure(builder);
    return builder.build();
  }
}
