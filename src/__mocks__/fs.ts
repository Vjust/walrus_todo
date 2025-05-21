// Mock fs module for Jest tests
const fs = {
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  statSync: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  unlink: jest.fn(),
  stat: jest.fn(),
  // Mock promises API
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn()
  }
};

// Export for both CommonJS and ES modules
module.exports = fs;
module.exports.default = fs;
module.exports.promises = fs.promises;
module.exports.readFileSync = fs.readFileSync;
module.exports.writeFileSync = fs.writeFileSync;
module.exports.existsSync = fs.existsSync;
module.exports.mkdirSync = fs.mkdirSync;
module.exports.readdirSync = fs.readdirSync;
module.exports.unlinkSync = fs.unlinkSync;
module.exports.statSync = fs.statSync;
module.exports.readFile = fs.readFile;
module.exports.writeFile = fs.writeFile;
module.exports.access = fs.access;
module.exports.mkdir = fs.mkdir;
module.exports.readdir = fs.readdir;
module.exports.unlink = fs.unlink;
module.exports.stat = fs.stat;