import fs from 'fs';
import util from 'util';
import DiskDriver from './interface';

const fopen = util.promisify(fs.open);
const fread = util.promisify(fs.read);
const fwrite = util.promisify(fs.write);

export default class NodejsDiskDriver implements DiskDriver {
  fileName: string;
  fd: number;
  isNew: boolean = false;
  constructor(fileName: string) {
    this.fileName = fileName;
  }
  async open() {
    try {
      this.fd = await fopen(this.fileName, 'r+');
    } catch (e) {
      this.fd = await fopen(this.fileName, 'w+');
      this.isNew = true;
    }
  }
  async read(
    position: number, size: number, output?: Uint8Array,
  ): Promise<Uint8Array> {
    let _output = output || Buffer.allocUnsafeSlow(size);
    await fread(this.fd, _output, 0, size, position);
    return _output;
  }
  async write(
    position: number, input: Uint8Array, size?: number,
  ): Promise<void> {
    await fwrite(this.fd, input, 0, input.length, position);
  }
}
