import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line no-console
console.log('Running TypeScript build in transpile-only mode...');

// Root directory of the project
const root = process.cwd();

// Load tsconfig.json
const configPath = path.join(root, 'tsconfig.json');
// eslint-disable-next-line no-console
console.log(`Using tsconfig: ${configPath}`);

// Parse the tsconfig.json
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  throw new Error(`Error reading tsconfig.json: ${configFile.error.messageText}`);
}

// Parse the parsed config
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  root
);

// Output directory from the config
const outDir = parsedConfig.options.outDir || path.join(root, 'dist');

// Make sure the output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Get all source files from the file system
const getSourceFiles = (dir: string, fileList: string[] = []): string[] => {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      // Skip node_modules
      if (file === 'node_modules' || file === 'dist' || file === '.git') {
        return;
      }
      fileList = getSourceFiles(filePath, fileList);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
};

// Get all TypeScript files in src directory
const sourceFiles = getSourceFiles(path.join(root, 'src'));
// eslint-disable-next-line no-console
console.log(`Transpiling ${sourceFiles.length} files...`);

// Keep track of files processed and errors
let filesProcessed = 0;
let errors = 0;

// Process each source file
sourceFiles.forEach(fileName => {
  try {
    // Read the file
    const sourceText = fs.readFileSync(fileName, 'utf8');
    
    // Transpile the file (no type checking)
    const { outputText } = ts.transpileModule(sourceText, {
      compilerOptions: {
        ...parsedConfig.options,
        noEmitOnError: false,
        declaration: false,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2019,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
      fileName,
      reportDiagnostics: false,
    });

    // Calculate output path
    const outputPath = fileName
      .replace(path.resolve(root, 'src'), path.join(outDir, 'src'))
      .replace(/\.tsx?$/, '.js');
    
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the transpiled file
    fs.writeFileSync(outputPath, outputText);
    filesProcessed++;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error processing ${fileName}:`, error);
    errors++;
  }
});

// eslint-disable-next-line no-console
console.log(`Build completed with ${filesProcessed} files successfully transpiled and ${errors} errors.`);