import bossam from 'bossam';

import File from './file';

type DirectoryNode = { name: string, address: number };

const namespace = bossam(`
  struct DirectoryList = Array<{
    name: String,
    address: u48,
  }>;
`);

export function encode(data: DirectoryNode[]): Uint8Array {
  return namespace['DirectoryList'].encode<DirectoryNode[]>(data);
}

export function decode(buffer: Uint8Array): DirectoryNode[] {
  return namespace['DirectoryList'].decode<DirectoryNode[]>(buffer);
}

export default class Directory extends File {
  files: DirectoryNode[] = null;
  dirty: boolean;
  
  async readdir(): Promise<DirectoryNode[]> {
    if (this.files == null) {
      this.reload();
    }
    return this.files;
  }
  
  async reload(): Promise<DirectoryNode[]> {
    if (this.length === 0) {
      this.files = [];
    } else {
      this.files = decode(await this.read(0, this.length));
    }
    return this.files;
  }

  async createFile(name: string, file: File): Promise<void> {
    if (await this.resolve(name) != null) {
      throw new Error('File already exists');
    }
    this.files.push({ name: name, address: file.id });
    this.dirty = true;
  }

  async unlinkFile(name: string): Promise<void> {
    this.files = this.files.filter(entry => {
      if (entry.name === name) return false;
      return true;
    });
    this.dirty = true;
  }

  async resolve(name: string): Promise<File | null> {
    await this.readdir();
    let result = this.files.find(v => v.name === name);
    if (result == null) return null;
    return this.fs.readFile(result.address);
  }

  async sync(): Promise<void> {
    if (this.dirty) return;
    await this.write(0, encode(this.files));
    this.dirty = false;
  }
}
