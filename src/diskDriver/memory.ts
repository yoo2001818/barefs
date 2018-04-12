import DiskDriver from './interface';

export default class MemoryDiskDriver implements DiskDriver {
  static BLOCK_SIZE = 4096;
  buffers: Buffer[] = [];
  size: number = 0;
  async read(
    position: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    let _output = output || Buffer.allocUnsafeSlow(size);
    if (position + size > this.size) {
      throw new Error('Memory disk out of bounds');
    }
    // Separate position and outputs to chunk
    const startSegment = Math.floor(position / MemoryDiskDriver.BLOCK_SIZE);
    const endAddr = position + size;
    const endSegment = Math.ceil(endAddr / MemoryDiskDriver.BLOCK_SIZE) - 1;
    let addr = 0;
    for (let segment = startSegment; segment <= endSegment; ++segment) {
      let buffer = this.buffers[segment];
      if (buffer == null) {
        buffer = this.buffers[segment] =
          Buffer.allocUnsafeSlow(MemoryDiskDriver.BLOCK_SIZE);
      }
      // Fill the buffer data
      let startPos = 0;
      let copySize = MemoryDiskDriver.BLOCK_SIZE;
      if (segment === startSegment) {
        startPos = position - (segment * MemoryDiskDriver.BLOCK_SIZE);
        copySize = MemoryDiskDriver.BLOCK_SIZE - position;
      }
      if (segment === endSegment) {
        copySize = size - addr;
      }
      _output.set(buffer.subarray(startPos, startPos + copySize), addr);
      addr = addr + copySize; 
    }
    return _output;
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
      let startPos = 0;
      let copySize = MemoryDiskDriver.BLOCK_SIZE;
      if (segment === startSegment) {
        startPos = position - (segment * MemoryDiskDriver.BLOCK_SIZE);
        copySize = MemoryDiskDriver.BLOCK_SIZE - position;
      }
      if (segment === endSegment) {
        copySize = (size || input.length) - addr;
      }
      buffer.set(input.subarray(addr, addr + copySize), startPos);
      addr = addr + copySize; 
    }
  }
}
