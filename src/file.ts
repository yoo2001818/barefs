import INode from './inode';
import FileSystem from './fileSystem';
import createDataView, { createUint8Array } from './util/dataView';

// TODO handle constants properly
const BLOCK_ENTRIES = 4096 / 4;
const BLOCK_ENTRIES_DOUBLE = BLOCK_ENTRIES * BLOCK_ENTRIES;
const BLOCK_ENTRIES_TRIPLE = BLOCK_ENTRIES_DOUBLE * BLOCK_ENTRIES;
const INDIRECT_SIZES = [BLOCK_ENTRIES, BLOCK_ENTRIES_DOUBLE,
   BLOCK_ENTRIES_TRIPLE];

async function resolveNode(file: File, block: number): Promise<number> {
  if (block !== 0) return block;
  let nextId = await file.fs.blockManager.next(3);
  await file.fs.writeBlock(nextId, 0, new Uint8Array(4096));
  return nextId;
}

type Stack = {
  type: string, depth?: number,
  offset: number, remainder?: number, block?: DataView,
  blockId?: number, dirty?: boolean, cleared?: boolean,
};

async function popStack(file: File, position: number, stack: Stack[]) {
  let sizeBlock = Math.ceil(file.length / FileSystem.BLOCK_SIZE);
  let top = stack.pop();
  if (top.dirty && top.type === 'indirect') {
    await file.fs.writeBlock(top.blockId, 0, createUint8Array(top.block));
  }
  if (top.type === 'indirect') { 
    let parent = stack[stack.length - 1];
    if (top.cleared &&
      (top.offset >= BLOCK_ENTRIES || position === sizeBlock)
    ) {
      await file.fs.blockManager.setType(top.blockId, 0);
      if (stack.length === 0) {
        file.inode.jumps[top.depth] = 0;
        file.inode.dirty = true;
      } else {
        parent.block.setUint32((parent.offset - 1) * 4, 0);
        parent.dirty = true;
      }
    } else if (stack.length > 0) {
      parent.cleared = false;
    }
  }
}

async function traverseFileNodes(file: File,
  startBlock: number, endBlock: number,
  callback: (position: number, blockId: number) => Promise<number | void>,
): Promise<void> {
  let sizeBlock = Math.ceil(file.length / FileSystem.BLOCK_SIZE);
  let position = startBlock;
  let stack: Stack[] = [];
  if (file.lastPos === position) {
    stack = file.lastStack;
  } else {
    await file.close();
  }
  while (position < endBlock) {
    if (stack.length === 0) {
      let pos = position;
      // Descend to the right node...
      if (pos < 12) {
        stack.push({ type: 'direct', offset: position });
        continue;
      }
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
            block: createDataView(await file.fs.readBlock(blockId)), 
            dirty: false,
            cleared: pos === 0,
          });
          break;
        }
        pos -= size;
      }
      continue;
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
        await popStack(file, position, stack);
      }
    } else if (top.type === 'indirect') {
      if (top.offset >= BLOCK_ENTRIES) {
        await popStack(file, position, stack);
        continue;
      }
      if (position >= endBlock) break;
      if (top.depth === 0) {
        let blockId = top.block.getUint32(top.offset * 4);
        let newId = await callback(position, blockId);
        if (typeof newId === 'number') {
          if (newId !== 0) top.cleared = false;
          top.dirty = true;
          top.block.setUint32(top.offset * 4, newId);
        } else {
          if (blockId !== 0) top.cleared = false;
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
          blockId,
          block: createDataView(await file.fs.readBlock(blockId)),
          dirty: false,
          cleared: top.remainder === 0,
        });
        top.offset ++;
        top.remainder = 0;
      }
    }
  }
  file.lastPos = position;
  file.lastStack = stack;
}

export default class File {
  static FILE_TYPE = 1;

  fs: FileSystem;
  inode: INode;
  lastPos: number = null;
  lastStack: Stack[];

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
  getMetadata(): INode {
    return this.inode;
  }
  setMetadata(diff: INode): void {
    this.inode = Object.assign({}, this.inode, diff);
    this.inode.dirty = true;
  }
  chmod(mode: number): void {
    this.inode.permission = mode;
    this.inode.dirty = true;
  }
  chown(uid: number, gid: number): void {
    this.inode.uid = uid;
    this.inode.gid = gid;
    this.inode.dirty = true;
  }
  utime(atime: number, mtime: number): void {
    // Sadly no atime is available due to space constraint
    this.inode.mtime = mtime;
    this.inode.dirty = true;
  }
  async save(): Promise<void> {
    if (!this.inode.dirty) return;
    await this.fs.inodeManager.write(this.inode.id, this.inode);
    this.inode.dirty = false;
  }
  async read(
    offset: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    if (offset + size > this.inode.length) {
      throw new Error('Offset out of bounds');
    }
    let startBlock = Math.floor(offset / FileSystem.BLOCK_SIZE);
    let endBlock = Math.ceil((offset + size) / FileSystem.BLOCK_SIZE);
    let buffer = output || new Uint8Array(size);
    let addr = 0;
    await traverseFileNodes(this, startBlock, endBlock,
      async (position: number, blockId: number) => {
        let startPos = 0;
        let copySize = FileSystem.BLOCK_SIZE;
        if (position === startBlock) {
          startPos = offset % FileSystem.BLOCK_SIZE;
          copySize = FileSystem.BLOCK_SIZE - startPos;
        }
        if (position === endBlock - 1) {
          copySize = size - addr;
        }
        let block = await this.fs.readBlock(blockId, startPos, copySize);
        buffer.set(block, addr);
        addr = addr + copySize; 
      },
    );
    return buffer;
  }
  async write(
    offset: number, input: Uint8Array, noSave: boolean = false,
  ): Promise<void> {
    let size = input.length;
    let startBlock = Math.floor(offset / FileSystem.BLOCK_SIZE);
    let endBlock = Math.ceil((offset + size) / FileSystem.BLOCK_SIZE);
    let addr = 0;
    await traverseFileNodes(this, startBlock, endBlock,
      async (position: number, blockId: number) => {
        let startPos = 0;
        let copySize = FileSystem.BLOCK_SIZE;
        if (position === startBlock) {
          startPos = offset % FileSystem.BLOCK_SIZE;
          copySize = FileSystem.BLOCK_SIZE - startPos;
        }
        if (position === endBlock - 1) {
          copySize = size - addr;
        }
        let newId = blockId;
        if (blockId === 0) {
          newId = await this.fs.blockManager.next(2);
        }
        await this.fs.writeBlock(newId, startPos,
          input.subarray(addr, addr + copySize));
        addr = addr + copySize; 
        if (blockId !== newId) return newId;
      },
    );
    if (offset + input.length > this.inode.length) {
      this.inode.length = offset + input.length;
      this.inode.mtime = Date.now();
      this.inode.dirty = true;
    }
    if (this.inode.dirty) {
      await this.fs.inodeManager.write(this.inode.id, this.inode);
      this.inode.dirty = false;
    }
    if (!noSave) {
      await this.close();
    }
  }
  async close(): Promise<void> {
    if (this.lastStack != null) {
      while (this.lastStack.length > 0) {
        popStack(this, this.lastPos, this.lastStack);
      }
      this.lastPos = null;
      this.lastStack = null;
    }
  }
  async truncate(size: number): Promise<void> {
    if (size > this.length) throw new Error('Offset out of bounds');
    let startBlock = Math.floor(size / FileSystem.BLOCK_SIZE) + 1;
    let endBlock = Math.ceil(this.length / FileSystem.BLOCK_SIZE);
    await traverseFileNodes(this, startBlock, endBlock,
      async (position: number, blockId: number) => {
        if (blockId !== 0) {
          // Free the block id for other use
          await this.fs.blockManager.setType(blockId, 0);
        }
        return 0;
      },
    );
    this.inode.length = size;
    await this.fs.inodeManager.write(this.inode.id, this.inode);
  }
}
