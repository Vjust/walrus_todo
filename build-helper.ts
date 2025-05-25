import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line no-console
process.stdout.write('Running TypeScript build in transpile-only mode...\n');

// Root directory of the project
const root = process.cwd();

// Load tsconfig.json
const configPath = path.join(root, 'tsconfig.json');
// eslint-disable-next-line no-console
process.stdout.write(`Using tsconfig: ${configPath}\n`);

// Parse the tsconfig.json
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  throw new Error(
    `Error reading tsconfig.json: ${configFile.error.messageText}`
  );
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

// Get the list of files to transpile
const sourceFileNames = parsedConfig.fileNames;
// eslint-disable-next-line no-console
process.stdout.write(`Transpiling ${sourceFileNames.length} files...\n`);

// Keep track of files processed and errors
let filesProcessed = 0;
let errors = 0;

// Process each source file
sourceFileNames.forEach(fileName => {
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
      },
      fileName,
      reportDiagnostics: false,
    });

    // Calculate output path
    const outputPath = fileName
      .replace(path.resolve(root), outDir)
      .replace(/\.tsx?$/, '.js');

    // Create output directory if it doesn't exist
    const outputFileDir = path.dirname(outputPath);
    if (!fs.existsSync(outputFileDir)) {
      fs.mkdirSync(outputFileDir, { recursive: true });
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
process.stdout.write(
  `Build completed with ${filesProcessed} files successfully transpiled and ${errors} errors.\n`
);
