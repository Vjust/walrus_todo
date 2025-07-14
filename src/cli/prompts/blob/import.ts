/**
 * Blob import prompts for the Waltodo CLI
 */

import inquirer from 'inquirer';

/**
 * Prompt for import options when fetching TODOs
 */
export async function promptImportOptions(existingTodoCount: number): Promise<{
  merge: boolean;
  overwriteExisting: boolean;
}> {
  if (existingTodoCount === 0) {
    return { merge: true, overwriteExisting: false };
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'importMode',
      message: `You have ${existingTodoCount} existing TODOs. How would you like to import?`,
      choices: [
        { 
          name: 'Merge with existing TODOs (recommended)', 
          value: 'merge',
          short: 'Merge'
        },
        { 
          name: 'Replace all existing TODOs', 
          value: 'replace',
          short: 'Replace'
        },
        { 
          name: 'Cancel import', 
          value: 'cancel',
          short: 'Cancel'
        }
      ]
    }
  ]);

  if (answers.importMode === 'cancel') {
    throw new Error('Import cancelled by user');
  }

  let overwriteExisting = false;
  if (answers.importMode === 'merge') {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Overwrite existing TODOs with same ID?',
        default: false
      }
    ]);
    overwriteExisting = overwrite;
  }

  return {
    merge: answers.importMode === 'merge',
    overwriteExisting
  };
}