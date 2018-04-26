import File from './file';

type DirectoryNode = { name: string, address: number };

export default class Directory extends File {
  files: DirectoryNode[] = [];
  
  async readdir(): Promise<DirectoryNode> {

  }

  async createFile(name: string, file: File): Promise<DirectoryNode> {

  }

  async unlinkFile(file: File): Promise<DirectoryNode> {

  }

  async resolve(name: string): Promise<File> {
    
  }

  async sync(): Promise<void> {

  }
}
