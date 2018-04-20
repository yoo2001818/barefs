import File from './file';
import FileSystem from './fileSystem';

export type BlockType = number;

export default class BlockManager {
  fs: FileSystem;
  bitmapFile: File;

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
  async next(): Promise<number> {
    // TODO Again, optimize it using cache....
    let position = 0;
    while (position < this.bitmapFile.length) {
      let block = await this.bitmapFile.read(position,
        Math.min(4096, this.bitmapFile.length - position));
      for (let i = 0; i < block.length; ++i) {
        if (block[i] === 0) return position + i;
      }
      position += 4096;
    }
    return this.bitmapFile.length;
  }
}
