#!/usr/bin/env node
import path from 'path';
import { COMMAND_NAME } from './constant';
import { colorText, registerWithElevatedPermissions, writeNodePathFile } from './utils';

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log(colorText(`Registering ${COMMAND_NAME} Native Messaging host...`, 'blue'));

  try {
    // Write Node.js path before registration
    writeNodePathFile(path.join(__dirname, '..'));

    await registerWithElevatedPermissions();
    console.log(
      colorText(
        'Registration succeeded! The Chrome extension can now communicate with the local service through Native Messaging.',
        'green',
      ),
    );
  } catch (error) {
    console.error(
      colorText(
        `Registration failed: ${error instanceof Error ? error.message : String(error)}`,
        'red',
      ),
    );
    process.exit(1);
  }
}

// Run the main function
main();
