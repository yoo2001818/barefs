declare module 'fuse-bindings' {
  export function mount(mnt: string, ops: any, cb: (error: any) => any): void;
  export function unmount(mnt: string, cb: (error: any) => any): void;
  export function context(): { pid: number, uid: number, gid: number };
  export function errno(code: string): number;
}
