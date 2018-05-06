import DirectoryFileSystem from './directoryFileSystem';
import Directory from './directory';
import File from './file';

const FILE_FLAGS: {
 [key: string]: {
   create: boolean, truncate: boolean, existsError: boolean, end: boolean,
  },
} = {
  'a': { create: true, truncate: false, existsError: false, end: true }, 
  'ax': { create: true, truncate: false, existsError: true, end: true }, 
  'a+': { create: true, truncate: false, existsError: false, end: true }, 
  'ax+': { create: true, truncate: false, existsError: true, end: true }, 
  'as': { create: true, truncate: false, existsError: false, end: true }, 
  'as+': { create: true, truncate: false, existsError: false, end: true }, 
  'r': { create: false, truncate: false, existsError: false, end: false },
  'r+': { create: false, truncate: false, existsError: false, end: false },
  'rs+': { create: false, truncate: false, existsError: false, end: false },
  'w': { create: true, truncate: true, existsError: false, end: false },
  'wx': { create: true, truncate: false, existsError: true, end: false },
  'w+': { create: true, truncate: true, existsError: false, end: false },
  'wx+': { create: true, truncate: false, existsError: true, end: false },
};

class Stats {
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  size: number;
  blksize: number;
  blocks: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
  constructor(file: File) {
    // Read file metadata into stats
    Object.assign(this, {
      dev: 0,
      ino: file.id,
      mode: file.inode.type,
      nlink: 1,
      uid: file.inode.uid,
      gid: file.inode.gid,
      rdev: null,
      size: file.length,
      blksize: Math.ceil(file.length / 4096) * 4096,
      blocks: file.length / 4096 | 0,
      atimeMs: 0,
      mtimeMs: file.inode.mtime,
      ctimeMs: file.inode.ctime,
      birthtimeMs: file.inode.ctime,
      atime: new Date(0),
      mtime: new Date(file.inode.mtime),
      ctime: new Date(file.inode.ctime),
      birthtime: new Date(file.inode.ctime),
    });
  }
  isBlockDevice() {
    return false;
  }
  isCharacterDevice() {
    return false;
  }
  isDirectory() {
    return this.mode === 1;
  }
  isFIFO() {
    return false;
  }
  isFile() {
    return this.mode === 0;
  }
  isSocket() {
    return false;
  }
  isSymbolicLink() {
    return false;
  }
}

// Wraps DirectoryFileSystem into Node.js-like fs object.
export default class NodeFSWrapper {
  fs: DirectoryFileSystem;
  fdTable: { file: File, pos: number }[];
  constructor(fs: DirectoryFileSystem) {
    this.fs = fs;
  }
  async resolveFile(path: string | number): Promise<File> {
    if (typeof path === 'string') {
      return this.fs.resolvePath(path);
    } else {
      let file = this.fdTable[path];
      if (file == null) throw new Error('Unknown file descriptor');
      return file.file;
    }
  }
  async chmod(path: string, mode: number, callback: (err?: Error) => any) {
    try {
      let file = await this.fs.resolvePath(path);
      if (file == null) throw new Error('File is null');
      file.chmod(mode);
      await file.save();
      callback();
    } catch (e) {
      callback(e);
    }
  }
  async chown(
    path: string, uid: number, gid: number, callback: (err?: Error) => any,
  ) {
    try {
      let file = await this.fs.resolvePath(path);
      if (file == null) throw new Error('File is null');
      file.chown(uid, gid);
      await file.save();
      callback();
    } catch (e) {
      callback(e);
    }
  }
  fsync(fd: any, callback: (err?: Error) => any) {
    return callback();
  }
  ftruncate(fd: number, len: number = 0, callback: (err?: Error) => any) {
    return this.truncate(fd, len, callback);
  }
  async truncate(
    path: string | number, len: number = 0, callback: (err?: Error) => any,
  ) {
    try {
      let file = await this.resolveFile(path);
      if (file == null) throw new Error('File is null');
      if (file instanceof Directory) {
        throw new Error('Cannot truncate directory');
      }
      await file.truncate(len);
      callback();
    } catch (e) {
      callback(e);
    }
  }
  // TODO Symlinks
  async mkdir(
    path: string, mode: number = 0o777, callback: (err?: Error) => any,
  ) {
    try {
      let dir = await this.fs.createDirectoryPath(path);
      dir.chmod(mode);
      await dir.save();
      callback();
    } catch (e) {
      callback(e);
    }
  }
  async open(
    path: string, flags: string, mode: number = 0o666,
    callback: (err: Error | null, fd?: number) => any,
  ) {
    try {
      // Flags can be one of:
      // a, ax, a+, ax+, as, as+, r, r+, rs+, w, wx, w+, wx+
      // Since Node.js doesn't support fseek or else, we don't have to
      // distinguish a / w except initialization.
      let flag = FILE_FLAGS[flags];
      if (flag == null) throw new Error('Unknown file flag');
      let file;
      try {
        file = await this.fs.resolvePath(path);
        if (flag.existsError) throw new Error('File exists');
        if (flag.truncate) await file.truncate(0);
      } catch (e) {
        if (e.message === 'ENOENT' && flag.create) {
          file = await this.fs.createFilePath(path);
        } else {
          throw e;
        }
      }
      let fd = this.fdTable.length;
      this.fdTable[fd] = { file, pos: flag.end ? file.length : 0 };
      callback(null, fd);
    } catch (e) {
      callback(e);
    }
  }
  async read(
    fd: number, buffer: Uint8Array | null, offset: number, length: number,
    position: number | null, callback: (
      err: Error | null, bytesRead?: number, buffer?: Uint8Array,
    ) => any,
  ) {
    try {
      let file = this.fdTable[fd];
      if (file == null) throw new Error('Unknown file descriptor');
      let pos: number = position;
      if (position == null) pos = file.pos;
      let buf = buffer || new Uint8Array(length);
      let part = buf.subarray(offset);
      await file.file.read(pos, length, part);
      callback(null, length, buf);
    } catch (e) {
      callback(e);
    }
  }
  async write(
    fd: number, buffer: Uint8Array, offset: number, length: number,
    position: number | null, callback: (
      err: Error | null, bytesWritten?: number, buffer?: Uint8Array,
    ) => any,
  ) {
    try {
      let file = this.fdTable[fd];
      if (file == null) throw new Error('Unknown file descriptor');
      let pos: number = position;
      if (position == null) pos = file.pos;
      let part = buffer.subarray(offset, length);
      await file.file.write(pos, part);
      callback(null, length, buffer);
    } catch (e) {
      callback(e);
    }
  }
  async close(fd: number, callback: (err?: Error) => any) {
    try {
      let file = this.fdTable[fd];
      if (file == null) throw new Error('Unknown file descriptor');
      await file.file.save();
      this.fdTable.splice(fd, 1);
      callback(null);
    } catch (e) {
      callback(e);
    }
  }
  async readdir(
    path: string, options: { encoding: string } | null, callback: (
      err: Error | null, files?: string[],
    ) => any,
  ) {
    try {
      let dir = await this.fs.resolvePath(path);
      if (!(dir instanceof Directory)) throw new Error('Not a directory');
      let files = await dir.readdir();
      callback(null, files.map(v => path + '/' + v.name));
    } catch (e) {
      callback(e);
    }
  }
  async rename(
    oldPath: string, newPath: string, callback: (err: Error) => any,
  ) {
    try {
      await this.fs.movePath(oldPath, newPath);
      callback(null);
    } catch (e) {
      callback(e);
    }
  }
  async rmdir(path: string, callback: (err: Error) => any) {
    try {
      await this.fs.unlinkPath(path);
      callback(null);
    } catch (e) {
      callback(e);
    }
  }
  async unlink(path: string, callback: (err: Error) => any) {
    try {
      await this.fs.unlinkPath(path);
      callback(null);
    } catch (e) {
      callback(e);
    }
  }
  async utimes(
    path: string | number, atime: number, mtime: number,
    callback: (err: Error) => any,
  ) {
    try {
      let file = await this.resolveFile(path);
      if (file == null) throw new Error('File is null');
      file.utime(new Date(atime).getTime(), new Date(mtime).getTime());
      await file.save();
      callback(null);
    } catch (e) {
      callback(e);
    }
  }
  futimes(
    path: number, atime: number, mtime: number, callback: (err: Error) => any,
  ) {
    return this.utimes(path, atime, mtime, callback);
  }
  async stat(path: string | number, callback: (err: Error, stat?: any) => any) {
    try {
      let file = await this.resolveFile(path);
      callback(null, new Stats(file));
    } catch (e) {
      callback(e);
    }
  }
  lstat(path: string, callback: (err: Error, stat?: any) => any) {
    return this.stat(path, callback);
  }
  fstat(fd: number, callback: (err: Error, stat?: any) => any) {
    return this.stat(fd, callback);
  }
}
