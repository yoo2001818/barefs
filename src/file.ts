import INode from './inode';
import FileSystem from './fileSystem';

const BLOCK_ENTRIES = FileSystem.BLOCK_SIZE / 4;
const BLOCK_ENTRIES_DOUBLE = BLOCK_ENTRIES * BLOCK_ENTRIES;
const BLOCK_ENTRIES_TRIPLE = BLOCK_ENTRIES_DOUBLE * BLOCK_ENTRIES;
const INDIRECT_SIZES = [BLOCK_ENTRIES, BLOCK_ENTRIES_DOUBLE,
   BLOCK_ENTRIES_TRIPLE];

async function resolveNode(file: File, block: number): Promise<number> {
  if (block !== 0) return block;
  let nextId = await file.fs.blockManager.next();
  await file.fs.writeBlock(nextId, 0, new Uint8Array(4096));
  await file.fs.blockManager.setType(nextId, 1);
  return nextId;
}

async function traverseFileNodes(file: File,
  startBlock: number, endBlock: number,
  callback: (position: number, blockId: number) => Promise<number | void>,
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
      if (pos < 12) stack.push({ type: 'direct', offset: position });
      pos -= 12;
      for (let i = 0; i < INDIRECT_SIZES.length; ++i) {
        let size = INDIRECT_SIZES[i];
        if (pos < size) {
          let blockId = await resolveNode(file, file.inode.jumps[i]);
          if (blockId !== file.inode.jumps[i]) {
            file.inode.jumps[i] = blockId;
            file.inode.dirty = true;
          }
          stack.push({
            type: 'indirect',
            depth: i,
            offset: i === 0 ? pos
              : pos / INDIRECT_SIZES[i - 1] | 0,
            remainder: i === 0 ? 0
              : pos % INDIRECT_SIZES[i - 1],
            blockId,
            block: new DataView(
              (await file.fs.readBlock(blockId)).buffer), 
            dirty: false,
          });
          break;
        }
        pos -= size;
      }
    }
    let top = stack[stack.length - 1];
    if (top.type === 'direct') {
      let newId = await callback(position, file.inode.pointers[top.offset]);
      if (typeof newId === 'number') {
        file.inode.pointers[top.offset] = newId;
        file.inode.dirty = true;
      }
      position ++;
      top.offset ++;
      if (top.offset >= 12) {
        stack.pop();
      }
    } else if (top.type === 'indirect') {
      if (top.offset >= BLOCK_ENTRIES) {
        if (top.dirty) {
          await file.fs.writeBlock(top.blockId, 0,
            new Uint8Array(top.block.buffer));
        }
        stack.pop();
        continue;
      }
      if (top.depth === 0) {
        let blockId = top.block.getUint32(top.offset * 4);
        let newId = await callback(position, blockId);
        if (typeof newId === 'number') {
          top.dirty = true;
          top.block.setUint32(top.offset * 4, newId);
        }
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
  if (stack.length > 0) {
    let top = stack[stack.length - 1];
    if (top.type === 'indirect' && top.dirty) {
      await file.fs.writeBlock(top.blockId, 0,
        new Uint8Array(top.block.buffer));
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
    offset: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    if (offset + size > this.inode.length) {
      throw new Error('Offset out of bounds');
    }
    let startBlock = Math.floor(offset / FileSystem.BLOCK_SIZE);
    let endBlock = Math.floor((offset + size) / FileSystem.BLOCK_SIZE);
    let buffer = new Uint8Array(size);
    await traverseFileNodes(this, startBlock, endBlock,
      async (position: number, blockId: number) => {
        let startPos = 0;
        let copySize = FileSystem.BLOCK_SIZE;
        if (position === startBlock) {
          startPos = position - offset;
          copySize = FileSystem.BLOCK_SIZE - startPos;
        }
        if (position === endBlock) {
          copySize = size - FileSystem.BLOCK_SIZE * (position - startBlock);
        }
        let block = await this.fs.readBlock(blockId, startPos, copySize);
        buffer.set(block, (position - startBlock) * FileSystem.BLOCK_SIZE);
      },
    );
    return buffer;
  }
  async write(
    offset: number, input: Uint8Array,
  ): Promise<void> {
    let size = input.length;
    let startBlock = Math.floor(offset / FileSystem.BLOCK_SIZE);
    let endBlock = Math.floor((offset + size) / FileSystem.BLOCK_SIZE);
    let addr = 0;
    await traverseFileNodes(this, startBlock, endBlock,
      async (position: number, blockId: number) => {
        let startPos = 0;
        let copySize = FileSystem.BLOCK_SIZE;
        if (position === startBlock) {
          startPos = position - offset;
          copySize = FileSystem.BLOCK_SIZE - startPos;
        }
        if (position === endBlock) {
          copySize = size - FileSystem.BLOCK_SIZE * (position - startBlock);
        }
        let newId = blockId;
        if (blockId === 0) newId = await this.fs.blockManager.next();
        await this.fs.writeBlock(newId, startPos,
          input.subarray(addr, addr + copySize));
        addr = addr + copySize; 
        if (blockId !== newId) return newId;
      },
    );
    if (offset + input.length > this.inode.length) {
      this.inode.length = offset + input.length;
      this.inode.dirty = true;
    }
    if (this.inode.dirty) {
      await this.fs.inodeManager.write(this.inode.id, this.inode);
    }
  }
  async truncate(size: number): Promise<void> {

  }
}
