import Heap from 'heap';

import File from './file';
import FileSystem from './fileSystem';

export type BlockType = number;

export default class BlockManager {
  fs: FileSystem;
  bitmapFile: File;
  preemptiveLock: boolean = false;
  cache: Heap<number> = new Heap();
  sweepPos: number = 0;

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
    if (value === 0) this.cache.push(id);
  }
  async next(value: BlockType): Promise<number> {
    let nextId = null;
    if (!this.cache.empty()) {
      nextId = this.cache.pop();
    } else {
      let position = this.sweepPos;
      while (position < this.bitmapFile.length) {
        let block = await this.bitmapFile.read(position,
          Math.min(4096, this.bitmapFile.length - position));
        for (let i = 0; i < block.length; ++i) {
          if (block[i] === 0) {
            if (nextId != null) {
              nextId = position + i;
            } else {
              this.cache.push(position + i);
            }
          }
        }
        if (nextId != null) break;
        position += 4096;
      }
      this.sweepPos = position;
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
      let pos = this.bitmapFile.length;
      let size = 8192 - (pos % 4096);
      await this.bitmapFile.write(pos, new Uint8Array(size));
      for (let i = this.sweepPos; i < pos + size; ++i) {
        this.cache.push(i);
      }
      this.sweepPos = this.bitmapFile.length;
      this.preemptiveLock = false;
    }
    return nextId;
  }
}
