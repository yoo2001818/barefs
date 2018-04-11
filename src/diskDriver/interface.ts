export default interface DiskDriver {
  read(
    position: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array>;
  write(position: number, output: Uint8Array, size?: number): Promise<void>;
}
