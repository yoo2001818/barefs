import INode from './inode';
import FileSystem from './fileSystem';

const BLOCK_ENTRIES = FileSystem.BLOCK_SIZE / 4;
const BLOCK_ENTRIES_DOUBLE = BLOCK_ENTRIES * BLOCK_ENTRIES;
const BLOCK_ENTRIES_TRIPLE = BLOCK_ENTRIES_DOUBLE * BLOCK_ENTRIES;
const INDIRECT_SIZES = [BLOCK_ENTRIES, BLOCK_ENTRIES_DOUBLE,
   BLOCK_ENTRIES_TRIPLE];

function getINodeAddress(address: number): number[] {
  // Get initial inode address for the data address.
  let blockId = Math.floor(address / FileSystem.BLOCK_SIZE);
  if (blockId < 12) return [0, blockId];
  blockId -= 12;
  if (blockId < BLOCK_ENTRIES) return [1, blockId];
  blockId -= BLOCK_ENTRIES;
  if (blockId < BLOCK_ENTRIES * BLOCK_ENTRIES) {
    return [2, (blockId / BLOCK_ENTRIES) | 0, blockId % BLOCK_ENTRIES];
  }
  blockId -= BLOCK_ENTRIES * BLOCK_ENTRIES;
  if (blockId < BLOCK_ENTRIES * BLOCK_ENTRIES * BLOCK_ENTRIES) {
    return [
      3,
      (blockId / BLOCK_ENTRIES / BLOCK_ENTRIES) | 0,
      ((blockId / BLOCK_ENTRIES) | 0) % BLOCK_ENTRIES,
      blockId % BLOCK_ENTRIES,
    ];
  }
  throw new Error('The file cannot be addressed since it is too large.');
}

async function traverseFileNodes(file: File,
  startBlock: number, endBlock: number,
  callback: (blockId: number) => Promise<number | void>,
): any {
  let position = startBlock;
  let stack: {
    type: string, depth?: number,
    offset: number, remainder?: number, block?: DataView,
  }[] = [];
  while (position < endBlock) {
    if (stack.length === 0) {
      let pos = position;
      // Descend to the right node...
      if (position < 12) stack.push({ type: 'direct', offset: position });
      pos -= 12;
      if (position < BLOCK_ENTRIES) {
        stack.push({
          type: 'indirect',
          depth: 0,
          offset: pos % BLOCK_ENTRIES,
          remainder: 0,
          block: new DataView(
            (await file.fs.readBlock(file.inode.jumps[0])).buffer), 
        });
      }
      pos -= BLOCK_ENTRIES;
      if (position < BLOCK_ENTRIES_DOUBLE) {
        stack.push({
          type: 'indirect',
          depth: 1,
          offset: pos / BLOCK_ENTRIES | 0,
          remainder: pos % BLOCK_ENTRIES,
          block: new DataView(
            (await file.fs.readBlock(file.inode.jumps[1])).buffer), 
        });
      }
      pos -= BLOCK_ENTRIES_DOUBLE;
      if (position < BLOCK_ENTRIES_TRIPLE) {
        stack.push({
          type: 'indirect',
          depth: 2,
          offset: pos / BLOCK_ENTRIES_DOUBLE | 0,
          remainder: pos % BLOCK_ENTRIES_DOUBLE,
          block: new DataView(
            (await file.fs.readBlock(file.inode.jumps[2])).buffer), 
        });
      }
    }
    let top = stack[stack.length - 1];
    if (top.type === 'direct') {
      await callback(file.inode.pointers[top.offset]);
      position ++;
      top.offset ++;
      if (top.offset >= 12) {
        stack.pop();
      }
    } else if (top.type === 'indirect') {
      if (top.depth === 0) {
        await callback(top.block.getUint32(top.offset));
        position ++;
      } else {
        stack.push({
          type: 'indirect',
          depth: top.depth - 1,
          offset: top.remainder / BLOCK_ENTRIES | 0,
          remainder: top.remainder % BLOCK_ENTRIES,
          block: new DataView(
            (await file.fs.readBlock(top.block.getFloat32(top.offset)).buffer), 
        })
      }
      top.offset ++;
      if (top.offset >= INDIRECT_SIZES[top.depth]) {
        stack.pop();
      }
    }
  }
}

export default class File {
  static FILE_TYPE = 1;

  fs: FileSystem;
  inode: INode;

  constructor(fs: FileSystem, inode: INode) {
    this.fs = fs;
    this.inode = inode;
  }
  get id(): number {
    return this.inode.id;
  }
  get length(): number {
    return this.inode.length;
  }
  async read(
    position: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    let address: BlockPointer = getINodeAddress(position);
    if (typeof address === 'number') {
      return this.fs.readBlock(this.inode.pointers[address]);
    } else {
      // Descend to the positioning node..
      let blocks: DataView[] = [];
      blocks[0] = new DataView((await this.fs.readBlock(
        this.inode.jumps[address.length - 1])).buffer);
      for (let i = 0; i < address.length; ++i) {
        // TODO getuint64
        let blockId = blocks[i].getUint32(address[i] * 4);
        if (i === address.length - 1) {
          return this.fs.readBlock(blockId);
        } else {
          blocks[i + 1] = new DataView(
            (await this.fs.readBlock(blockId)).buffer);
        }
      }
    }
  }
  async write(
    position: number, input: Uint8Array, size?: number,
  ): Promise<void> {
  }
  async truncate(size: number): Promise<void> {

  }
}
