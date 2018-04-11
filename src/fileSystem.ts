import INode from './inode';
import File from './file';
import DiskDriver from './diskDriver/interface';

export default class FileSystem {
  static BLOCK_SIZE = 4096;
  static INODE_SIZE = 128;
  diskDriver: DiskDriver;
  metadata: any;
  inodeBlockList: File;
  blockBitmap: File;
  FileSystem(driver: DiskDriver) {

  }
  static async mkfs(driver: DiskDriver): Promise<FileSystem> {
    // Create new metadata and write inode block list / block bitmap
  }
  async getFreeBlockId(size: number = 1): Promise<number> {
    // Get next free block ID. Will find next best non-fragmented space if
    // size is provided.
    return 1;
  }
  async getFreeINode(): Promise<INode> {
    // Get next free inode
    return null;
  }
  async init(): Promise<void> {
    // Read metadata and read inode / block bitmap to buffer
  }
  async close(): Promise<void> {
    // Write metadata to disk
  }
  async createFile(): Promise<File> {
    // Get free inode and wrap file
  }
  async read(id: number): Promise<INode> {
    // Read inode from disk, or buffer (if in cache)
  }
  async readFile(id: number): Promise<File> {
    // Read inode and wrap with file
  }
  async unlink(inode: INode): Promise<void> {
    // Delete inode and mark on the bitmap
  }
  async unlinkFile(file: File): Promise<void> {
    // Delete whole data node
  }
  async setBlockType(id: number, value: number): Promise<void> {
    // Set bitmap data
  }
}
