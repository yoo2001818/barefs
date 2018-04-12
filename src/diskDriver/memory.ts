import DiskDriver from './interface';

export default class MemoryDiskDriver implements DiskDriver {
  static BLOCK_SIZE = 4096;
  buffers: Buffer[] = [];
  size: number = 0;
  async read(
    position: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    if (position + size > this.size) {
      throw new Error('Memory disk out of bounds');
    }
    return null;
  }
  async write(
    position: number, input: Uint8Array, size?: number,
  ): Promise<void> {
    // Separate position and outputs to chunk
    const startSegment = Math.floor(position / MemoryDiskDriver.BLOCK_SIZE);
    const endAddr = position + (size || input.length);
    this.size = Math.max(endAddr, this.size);
    const endSegment = Math.ceil(endAddr / MemoryDiskDriver.BLOCK_SIZE) - 1;
    let addr = 0;
    for (let segment = startSegment; segment <= endSegment; ++segment) {
      let buffer = this.buffers[segment];
      if (buffer == null) {
        buffer = this.buffers[segment] =
          Buffer.allocUnsafeSlow(MemoryDiskDriver.BLOCK_SIZE);
      }
      // Fill the buffer data
      if (segment === startSegment || segment === endSegment) {
        let startPos = position - (segment * MemoryDiskDriver.BLOCK_SIZE);
        let addrEnd = Math.min(size || input.length,
          (segment + 1) * MemoryDiskDriver.BLOCK_SIZE - startPos);
        buffer.set(input.subarray(addr, addrEnd), startPos);
        addr = addrEnd; 
      } else {
        buffer.set(input.subarray(addr,
          addr + MemoryDiskDriver.BLOCK_SIZE), 0);
        addr += MemoryDiskDriver.BLOCK_SIZE;
      }
    }
  }
}
