import File from './file';
import FileSystem from './fileSystem';

export type BlockType = number;

export default class BlockManager {
  fs: FileSystem;
  bitmapFile: File;
  preemptiveLock: boolean = false;

  constructor(fs: FileSystem) {
    this.fs = fs;
  }
  init(bitmapFile: File): void {
    this.bitmapFile = bitmapFile;
  }
  async getType(id: number): Promise<BlockType> {
    // TODO Optimize it using cache....
    return (await this.bitmapFile.read(id, 1))[0];
  }
  async setType(id: number, value: BlockType): Promise<void> {
    await this.bitmapFile.write(id, new Uint8Array([value]));
  }
  async next(value: BlockType): Promise<number> {
    // TODO Again, optimize it using cache....
    let nextId = null;
    let position = 0;
    while (position < this.bitmapFile.length) {
      let block = await this.bitmapFile.read(position,
        Math.min(4096, this.bitmapFile.length - position));
      for (let i = 0; i < block.length; ++i) {
        if (block[i] === 0) {
          nextId = position + i;
          break;
        }
      }
      if (nextId != null) break;
      position += 4096;
    }
    if (nextId == null) {
      nextId = this.bitmapFile.length;
    }
    await this.setType(nextId, value);
    // If less than 4096 bytes are left, allocate 4096 bytes more.
    // To prevent infinite loop, lock this since it is not possible to
    // pass the scope information.
    if (nextId + 4096 > this.bitmapFile.length && !this.preemptiveLock) {
      console.log('allocating', nextId, this.bitmapFile.length);
      this.preemptiveLock = true;
      await this.bitmapFile.write(this.bitmapFile.length,
        new Uint8Array(8192 - (this.bitmapFile.length) % 4096));
      this.preemptiveLock = false;
    }
    return nextId;
  }
}
