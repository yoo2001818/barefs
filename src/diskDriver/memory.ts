import DiskDriver from './interface';

export default class MemoryDiskDriver implements DiskDriver {
  async read(
    position: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    return null;
  }
  async write(
    position: number, output: Uint8Array, size?: number,
  ): Promise<void> {
    
  }
}
