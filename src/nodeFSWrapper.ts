import DirectoryFileSystem from './directoryFileSystem';
import Directory from './directory';
import File from './file';

const FILE_FLAGS: {
 [key: string]: { create: boolean, truncate: boolean, existsError: boolean },
} = {
  'a': { create: true, truncate: false, existsError: false }, 
  'ax': { create: true, truncate: false, existsError: true }, 
  'a+': { create: true, truncate: false, existsError: false }, 
  'ax+': { create: true, truncate: false, existsError: true }, 
  'as': { create: true, truncate: false, existsError: false }, 
  'as+': { create: true, truncate: false, existsError: false }, 
  'r': { create: false, truncate: false, existsError: false },
  'r+': { create: false, truncate: false, existsError: false },
  'rs+': { create: false, truncate: false, existsError: false },
  'w': { create: true, truncate: true, existsError: false },
  'wx': { create: true, truncate: false, existsError: true },
  'w+': { create: true, truncate: true, existsError: false },
  'wx+': { create: true, truncate: false, existsError: true },
};

// Wraps DirectoryFileSystem into Node.js-like fs object.
export default class NodeFSWrapper {
  fs: DirectoryFileSystem;
  fdTable: File[];
  constructor(fs: DirectoryFileSystem) {
    this.fs = fs;
  }
  async resolveFile(path: string | number): Promise<File> {
    if (typeof path === 'string') {
      return this.fs.resolvePath(path);
    } else {
      let file = this.fdTable[path];
      if (file == null) throw new Error('Unknown file descriptor');
      return file;
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
      this.fdTable[fd] = file;
      callback(null, fd);
    } catch (e) {
      callback(e);
    }
  }
}
