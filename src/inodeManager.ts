import File from './file';
import INode, { encode, decode, createEmpty } from './inode';
import FileSystem from './fileSystem';
import createDataView, { createUint8Array } from './util/dataView';

export type BlockType = number;

// TODO handle constants properly
const INODE_COUNT = 4096 / 128;
export default class INodeManager {
  fs: FileSystem;
  blockListFile: File;

  constructor(fs: FileSystem) {
    this.fs = fs;
  }
  init(blockListFile: File): void {
    this.blockListFile = blockListFile;
  }
  async getBlockId(id: number): Promise<number> {
    if (this.blockListFile == null || this.blockListFile.length === 0) {
      return id;
    }
    // Translate inode ID to block ID
    let blockPos = Math.floor(id / INODE_COUNT);
    return createDataView(
      await this.blockListFile.read(16 * blockPos + 4, 4)).getUint32(0);
  }
  async read(id: number): Promise<INode> {
    let blockId = await this.getBlockId(id);
    return decode(id,
      await this.fs.diskDriver.read((id % INODE_COUNT) * FileSystem.INODE_SIZE,
      FileSystem.INODE_SIZE));
  }
  async write(id: number, inode: INode): Promise<void> {
    let blockId = await this.getBlockId(id);
    await this.fs.diskDriver.write((id % INODE_COUNT) * FileSystem.INODE_SIZE,
      encode(inode));
  }
  async next(): Promise<INode> {
    // TODO Optimize it using cache....
    let position = 0;
    let found = false;
    let result = this.blockListFile.length / 12 * INODE_COUNT;
    while (position * 4096 < this.blockListFile.length) {
      let block = createDataView(await this.blockListFile.read(position * 4096,
        Math.min(4096, this.blockListFile.length - position * 4096)));
      for (let i = 0; i < block.byteLength; i += 12) {
        let bitset = block.getUint32(i + 8) | 0;
        if (bitset !== (0xFFFFFFFF | 0)) {
          for (let j = 0; j < 32; ++j) {
            if ((bitset & (1 << j)) === 0) {
              result = position * INODE_COUNT + j;
              found = true;
              break;
            }
          } 
          break;
        }
      }
      if (found) break;
      position ++;
    }
    let inode = createEmpty();
    inode.id = result;
    // Set bitset data
    let blockPos = Math.floor(inode.id / INODE_COUNT);
    let bitsetView;
    let bitset;
    if (this.blockListFile.length > blockPos * 12) {
      bitsetView = createDataView(
        await this.blockListFile.read(12 * blockPos, 12))
      bitset = bitsetView.getUint32(8);
    } else {
      bitsetView = createDataView(new Uint8Array(12));
      bitset = 0;
      await this.fs.setType(blockPos, 1);
    }
    bitset |= 1 << (inode.id % INODE_COUNT);
    bitsetView.setUint32(8, bitset);
    console.log('AAAAAAA', 12 * blockPos, createUint8Array(bitsetView));
    await this.blockListFile.write(12 * blockPos, createUint8Array(bitsetView));
    return inode;
  }
  async unlink(inode: INode): Promise<void> {
    let blockPos = Math.floor(inode.id / INODE_COUNT);
    let bitsetView;
    let bitset;
    // TODO We should probably remove inode if inode is empty.
    bitsetView = createDataView(
      await this.blockListFile.read(12 * blockPos, 12))
    bitset = bitsetView.getUint32(8);
    bitset &= ~(1 << (inode.id % INODE_COUNT));
    bitsetView.setUint32(8, bitset);
    await this.blockListFile.write(12 * blockPos, createUint8Array(bitsetView));
  }
}
