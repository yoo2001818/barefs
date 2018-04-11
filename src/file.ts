import INode from './inode';

export default class File {
  static FILE_TYPE = 1;
  inode: INode;
  get id(): number {
    return 0;
  }
  get length(): number {
    return 50;
  }
  async read(
    position: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    return new Uint8Array(10);
  }
  async write(
    position: number, input: Uint8Array, size?: number,
  ): Promise<void> {
  }
}
