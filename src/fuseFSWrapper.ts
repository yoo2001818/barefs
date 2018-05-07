import fuse from 'fuse-bindings';

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
    let mode = file.inode.type ? 0o40000 : 0o100000;
    Object.assign(this, {
      dev: 0,
      ino: file.id,
      mode: mode | file.inode.permission,
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
export class FuseFSWrapper {
  fs: DirectoryFileSystem;
  fdTable: { file: File, pos: number }[] = [];
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
  async chmod(path: string, mode: number, callback: (err: number) => any) {
    try {
      let file = await this.fs.resolvePath(path);
      if (file == null) throw new Error('File is null');
      file.chmod(mode);
      await file.save();
      callback(0);
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  async chown(
    path: string, uid: number, gid: number, callback: (err: number) => any,
  ) {
    try {
      let file = await this.fs.resolvePath(path);
      if (file == null) throw new Error('File is null');
      file.chown(uid, gid);
      await file.save();
      callback(0);
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  fsync(path: any, fd: any, datasync: any, callback: (err: number) => any) {
    return callback(0);
  }
  ftruncate(
    path: string, fd: number, len: number = 0, callback: (err: number) => any,
  ) {
    return this.truncate(fd, len, callback);
  }
  async truncate(
    path: string | number, len: number = 0, callback: (err: number) => any,
  ) {
    try {
      let file = await this.resolveFile(path);
      if (file == null) throw new Error('File is null');
      if (file instanceof Directory) {
        throw new Error('Cannot truncate directory');
      }
      await file.truncate(len);
      callback(0);
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  // TODO Symlinks
  async mkdir(
    path: string, mode: number = 0o777, callback: (err: number) => any,
  ) {
    console.log('mkdir', path);
    try {
      let dir = await this.fs.createDirectoryPath(path);
      dir.chmod(mode);
      console.log('writeeee', dir.id);
      await dir.save();
      callback(0);
    } catch (e) {
      console.error(e);
      callback(fuse.errno(e.code));
    }
  }
  async open(
    path: string, flags: string | number,
    callback: (err: number, fd?: number) => any,
  ) {
    if (typeof flags === 'number') {
      let flagName = 'a+';
      if ((flags & 3) === 0) flagName = 'r';
      if ((flags & 3) === 1) flagName = 'w';
      flags = flagName;
    }
    console.log('open', path, flags);
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
        if (e.code === 'ENOENT' && flag.create) {
          file = await this.fs.createFilePath(path);
        } else {
          throw e;
        }
      }
      let fd = this.fdTable.length;
      this.fdTable[fd] = { file, pos: flag.end ? file.length : 0 };
      console.log('fd', fd);
      callback(0, fd);
    } catch (e) {
      console.log(e);
      callback(fuse.errno(e.code));
    }
  }
  create(
    path: string, flags: string | number,
    callback: (err: number, fd?: number) => any,
  ) {
    return this.open(path, 'w', callback);
  }
  async read(
    path: string, fd: number, buffer: Uint8Array | null,
    length: number, position: number | null, callback: (
      bytesRead?: number, buffer?: Uint8Array,
    ) => any,
  ) {
    try {
      let file = this.fdTable[fd];
      if (file == null) throw new Error('Unknown file descriptor');
      let pos: number = position;
      if (position == null) pos = file.pos;
      let buf = buffer || new Uint8Array(length);
      let len = Math.min(file.file.length - pos, length);
      await file.file.read(pos, len, buf);
      callback(len, buf);
    } catch (e) {
      console.log(e);
      callback(0);
    }
  }
  async write(
    path: string, fd: number, buffer: Uint8Array,
    length: number, position: number | null, callback: (
      bytesWritten?: number, buffer?: Uint8Array,
    ) => any,
  ) {
    try {
      let file = this.fdTable[fd];
      if (file == null) throw new Error('Unknown file descriptor');
      let pos: number = position;
      if (position == null) pos = file.pos;
      await file.file.write(pos, buffer);
      callback(length, buffer);
    } catch (e) {
      console.log(e);
      callback(0);
    }
  }
  async close(fd: number, callback: (err: number) => any) {
    try {
      let file = this.fdTable[fd];
      if (file == null) throw new Error('Unknown file descriptor');
      await file.file.save();
      // this.fdTable.splice(fd, 1);
      callback(0);
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  async release(path: string, fd: number, callback: (err: number) => any) {
    return this.close(fd, callback);
  }
  async readdir(
    path: string, callback: (err: number, files?: string[]) => any,
  ) {
    try {
      let dir = await this.fs.resolvePath(path);
      if (!(dir instanceof Directory)) throw new Error('Not a directory');
      let files = await dir.readdir();
      console.log(files);
      callback(0, ['.', '..'].concat(files.map(v => v.name)));
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  async rename(
    oldPath: string, newPath: string, callback: (err: number) => any,
  ) {
    try {
      await this.fs.movePath(oldPath, newPath);
      callback(0);
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  async rmdir(path: string, callback: (err: number) => any) {
    try {
      await this.fs.unlinkPath(path);
      callback(0);
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  async unlink(path: string, callback: (err: number) => any) {
    try {
      await this.fs.unlinkPath(path);
      callback(0);
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  async utimes(
    path: string | number, atime: number, mtime: number,
    callback: (err: number) => any,
  ) {
    console.log('utimes', path, atime, mtime);
    try {
      let file = await this.resolveFile(path);
      file.utime(new Date(atime).getTime(), new Date(mtime).getTime());
      await file.save();
      callback(0);
    } catch (e) {
      console.log(e);
      callback(fuse.errno(e.code));
    }
  }
  futimes(
    path: number, atime: number, mtime: number, callback: (err: number) => any,
  ) {
    return this.utimes(path, atime, mtime, callback);
  }
  utimens(
    path: string, atime: number, mtime: number,
    callback: (err: number) => any,
  ) {
    return this.utimes(path, atime, mtime, callback);
  }
  async stat(
    path: string | number, callback: (err: number, stat?: any) => any,
  ) {
    console.log('stat', path);
    try {
      let file = await this.resolveFile(path);
      callback(0, new Stats(file));
    } catch (e) {
      callback(fuse.errno(e.code));
    }
  }
  lstat(path: string, callback: (err: number, stat?: any) => any) {
    return this.stat(path, callback);
  }
  fstat(fd: number, callback: (err: number, stat?: any) => any) {
    return this.stat(fd, callback);
  }
  getattr(path: string, callback: (err: number, stat?: any) => any) {
    return this.stat(path, callback);
  }
  fgetattr(
    path: string, fd: number, callback: (err: number, stat?: any) => any,
  ) {
    return this.stat(fd, callback);
  }
}

export default function (fs: DirectoryFileSystem) {
  let wrapper: any = new FuseFSWrapper(fs);
  let proto: { [key: string]: any } = FuseFSWrapper.prototype;
  for (let key in proto) {
    let entry: any = proto[key];
    if (typeof entry === 'function') {
      wrapper[key] = entry.bind(wrapper);
    }
  }
  return wrapper;
}
