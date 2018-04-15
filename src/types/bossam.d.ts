declare module 'bossam' {
  interface Type {
    encode<T>(value: T): Uint8Array;
    decode<T>(array: Uint8Array): T;
  }

  type Namespace = {
    resolve(name: string): Type;
  } & {
    [key: string]: Type;
  };

  function compile(code: string, namespace?: Namespace): Namespace;

  export = compile;
}
