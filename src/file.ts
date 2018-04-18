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

async function resolveNode(file: File, block: number): Promise<number> {
  if (block !== 0) return block;
  let nextId = await file.fs.blockManager.next();
  await file.fs.writeBlock(nextId, 0, new Uint8Array(4096));
  return nextId;
}

async function traverseFileNodes(file: File,
  startBlock: number, endBlock: number,
  callback: (blockId: number) => Promise<number | void>,
  shouldWrite: boolean,
): Promise<void> {
  let position = startBlock;
  let stack: {
    type: string, depth?: number,
    offset: number, remainder?: number, block?: DataView,
    blockId?: number, dirty?: boolean,
  }[] = [];
  while (position < endBlock) {
    if (stack.length === 0) {
      let pos = position;
      // Descend to the right node...
      if (position < 12) stack.push({ type: 'direct', offset: position });
      pos -= 12;
      if (position < BLOCK_ENTRIES) {
        let blockId = await resolveNode(file, file.inode.jumps[0]);
        if (blockId !== file.inode.jumps[0]) {
          file.inode.jumps[0] = blockId;
          file.inode.dirty = true;
        }
        stack.push({
          type: 'indirect',
          depth: 0,
          offset: pos % BLOCK_ENTRIES,
          remainder: 0,
          blockId,
          block: new DataView(
            (await file.fs.readBlock(blockId)).buffer), 
          dirty: false,
        });
      }
      pos -= BLOCK_ENTRIES;
      if (position < BLOCK_ENTRIES_DOUBLE) {
        let blockId = await resolveNode(file, file.inode.jumps[1]);
        if (blockId !== file.inode.jumps[1]) {
          file.inode.jumps[1] = blockId;
          file.inode.dirty = true;
        }
        stack.push({
          type: 'indirect',
          depth: 1,
          offset: pos / BLOCK_ENTRIES | 0,
          remainder: pos % BLOCK_ENTRIES,
          blockId,
          block: new DataView(
            (await file.fs.readBlock(blockId)).buffer), 
          dirty: false,
        });
      }
      pos -= BLOCK_ENTRIES_DOUBLE;
      if (position < BLOCK_ENTRIES_TRIPLE) {
        let blockId = await resolveNode(file, file.inode.jumps[2]);
        if (blockId !== file.inode.jumps[2]) {
          file.inode.jumps[2] = blockId;
          file.inode.dirty = true;
        }
        stack.push({
          type: 'indirect',
          depth: 2,
          offset: pos / BLOCK_ENTRIES_DOUBLE | 0,
          remainder: pos % BLOCK_ENTRIES_DOUBLE,
          blockId,
          block: new DataView(
            (await file.fs.readBlock(blockId)).buffer), 
          dirty: false,
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
    } else if (top.type === 'indirect') 
      if (top.offset > BLOCK_ENTRIES) {
        if (top.dirty) {
          await file.fs.writeBlock(top.blockId, 0,
            new Uint8Array(top.block.buffer));
        }
        stack.pop();
        continue;
      }
      if (top.depth === 0) {
        await callback(top.block.getUint32(top.offset * 4));
        top.offset ++;
        position ++;
      } else {
        let tmpId = top.block.getUint32(top.offset * 4);
        let blockId = await resolveNode(file, tmpId);
        if (blockId !== tmpId) {
          top.dirty = true;
          top.block.setUint32(top.offset * 4, blockId);
        }
        stack.push({
          type: 'indirect',
          depth: top.depth - 1,
          offset: top.depth === 1 ? top.remainder
            : top.remainder / INDIRECT_SIZES[top.depth - 1] | 0,
          remainder: top.depth === 1 ? 0
            : top.remainder % INDIRECT_SIZES[top.depth - 1],
          block: new DataView(
            (await file.fs.readBlock(blockId)).buffer), 
          dirty: false,
        });
        top.offset ++;
        top.remainder = 0;
      }
      top.offset ++;
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
        let tmpId = blocks[i].getUint32(address[i] * 4);
        
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
