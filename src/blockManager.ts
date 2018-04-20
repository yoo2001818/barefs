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
    return 0;
  }

  async setType(id: number, value: BlockType): Promise<void> {
  }

  async next(): Promise<number> {
    return 1;
  }
}
