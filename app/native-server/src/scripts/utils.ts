import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { COMMAND_NAME, DESCRIPTION, EXTENSION_ID, HOST_NAME } from './constant';
import { BrowserType, getBrowserConfig, detectInstalledBrowsers } from './browser-config';

export const access = promisify(fs.access);
export const mkdir = promisify(fs.mkdir);
export const writeFile = promisify(fs.writeFile);

/**
 * Get the log directory path for wrapper scripts.
 * Uses platform-appropriate user directories to avoid permission issues.
 *
 * - macOS: ~/Library/Logs/mcp-chrome-bridge
 * - Windows: %LOCALAPPDATA%/mcp-chrome-bridge/logs
 * - Linux: $XDG_STATE_HOME/mcp-chrome-bridge/logs or ~/.local/state/mcp-chrome-bridge/logs
 */
export function getLogDir(): string {
  const homedir = os.homedir();

  if (os.platform() === 'darwin') {
    return path.join(homedir, 'Library', 'Logs', 'mcp-chrome-bridge');
  } else if (os.platform() === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local'),
      'mcp-chrome-bridge',
      'logs',
    );
  } else {
    // Linux: XDG_STATE_HOME or ~/.local/state
    const xdgState = process.env.XDG_STATE_HOME || path.join(homedir, '.local', 'state');
    return path.join(xdgState, 'mcp-chrome-bridge', 'logs');
  }
}

/**
 * Print colored text
 */
export function colorText(text: string, color: string): string {
  const colors: Record<string, string> = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
  };

  return colors[color] + text + colors.reset;
}

/**
 * Get user-level manifest file path
 */
export function getUserManifestPath(): string {
  if (os.platform() === 'win32') {
    // Windows: %APPDATA%\Google\Chrome\NativeMessagingHosts\
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else if (os.platform() === 'darwin') {
    // macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else {
    // Linux: ~/.config/google-chrome/NativeMessagingHosts/
    return path.join(
      os.homedir(),
      '.config',
      'google-chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  }
}

/**
 * Get system-level manifest file path
 */
export function getSystemManifestPath(): string {
  if (os.platform() === 'win32') {
    // Windows: %ProgramFiles%\Google\Chrome\NativeMessagingHosts\
    return path.join(
      process.env.ProgramFiles || 'C:\\Program Files',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`,
    );
  } else if (os.platform() === 'darwin') {
    // macOS: /Library/Google/Chrome/NativeMessagingHosts/
    return path.join('/Library', 'Google', 'Chrome', 'NativeMessagingHosts', `${HOST_NAME}.json`);
  } else {
    // Linux: /etc/opt/chrome/native-messaging-hosts/
    return path.join('/etc', 'opt', 'chrome', 'native-messaging-hosts', `${HOST_NAME}.json`);
  }
}

/**
 * Get native host startup script file path
 */
export async function getMainPath(): Promise<string> {
  try {
    const packageDistDir = path.join(__dirname, '..');
    const wrapperScriptName = process.platform === 'win32' ? 'run_host.bat' : 'run_host.sh';
    const absoluteWrapperPath = path.resolve(packageDistDir, wrapperScriptName);
    return absoluteWrapperPath;
  } catch (error) {
    console.log(colorText('Cannot find global package path, using current directory', 'yellow'));
    throw error;
  }
}

/**
 * Write Node.js executable path to node_path.txt for run_host scripts.
 * This ensures the native host uses the same Node.js version that was used during installation,
 * avoiding NODE_MODULE_VERSION mismatch errors with native modules like better-sqlite3.
 *
 * @param distDir - The dist directory where node_path.txt should be written
 * @param nodeExecPath - The Node.js executable path to write (defaults to current process.execPath)
 */
export function writeNodePathFile(distDir: string, nodeExecPath = process.execPath): void {
  try {
    const nodePathFile = path.join(distDir, 'node_path.txt');
    fs.mkdirSync(distDir, { recursive: true });

    console.log(colorText(`Writing Node.js path: ${nodeExecPath}`, 'blue'));
    fs.writeFileSync(nodePathFile, nodeExecPath, 'utf8');
    console.log(colorText('✓ Node.js path written for run_host scripts', 'green'));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(colorText(`⚠️ Failed to write Node.js path: ${message}`, 'yellow'));
  }
}

/**
 * Make sure key files have execution permissions
 */
export async function ensureExecutionPermissions(): Promise<void> {
  try {
    const packageDistDir = path.join(__dirname, '..');

    if (process.platform === 'win32') {
      // Windows platform handling
      await ensureWindowsFilePermissions(packageDistDir);
      return;
    }

    // Unix/Linux platform handling
    const filesToCheck = [
      path.join(packageDistDir, 'index.js'),
      path.join(packageDistDir, 'run_host.sh'),
      path.join(packageDistDir, 'cli.js'),
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        try {
          fs.chmodSync(filePath, '755');
          console.log(
            colorText(`✓ Set execution permissions for ${path.basename(filePath)}`, 'green'),
          );
        } catch (err) {
          console.warn(
            colorText(
              `⚠️ Unable to set execution permissions for ${path.basename(filePath)}: ${err instanceof Error ? err.message : String(err)}`,
              'yellow',
            ),
          );
        }
      } else {
        console.warn(colorText(`⚠️ File not found: ${filePath}`, 'yellow'));
      }
    }
  } catch (error) {
    console.warn(
      colorText(
        `⚠️ Error ensuring execution permissions: ${error instanceof Error ? error.message : String(error)}`,
        'yellow',
      ),
    );
  }
}

/**
 * Windows platform file permission handling
 */
async function ensureWindowsFilePermissions(packageDistDir: string): Promise<void> {
  const filesToCheck = [
    path.join(packageDistDir, 'index.js'),
    path.join(packageDistDir, 'run_host.bat'),
    path.join(packageDistDir, 'cli.js'),
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      try {
        // Check whether the file is read-only and remove the read-only attribute if so
        const stats = fs.statSync(filePath);
        if (!(stats.mode & parseInt('200', 8))) {
          // Check write permission
          // Try to remove the read-only attribute
          fs.chmodSync(filePath, stats.mode | parseInt('200', 8));
          console.log(
            colorText(`✓ Removed read-only attribute from ${path.basename(filePath)}`, 'green'),
          );
        }

        // Verify file readability
        fs.accessSync(filePath, fs.constants.R_OK);
        console.log(
          colorText(`✓ Verified file accessibility for ${path.basename(filePath)}`, 'green'),
        );
      } catch (err) {
        console.warn(
          colorText(
            `⚠️ Unable to verify file permissions for ${path.basename(filePath)}: ${err instanceof Error ? err.message : String(err)}`,
            'yellow',
          ),
        );
      }
    } else {
      console.warn(colorText(`⚠️ File not found: ${filePath}`, 'yellow'));
    }
  }
}

/** Native Messaging host manifest written to the browser hosts directory. */
export interface NativeHostManifest {
  name: string;
  description: string;
  path: string;
  type: string;
  allowed_origins: string[];
}

/**
 * Create Native Messaging host manifest content
 */
export async function createManifestContent(): Promise<NativeHostManifest> {
  const mainPath = await getMainPath();

  return {
    name: HOST_NAME,
    description: DESCRIPTION,
    path: mainPath, // Node.js executable path
    type: 'stdio',
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
  };
}

/**
 * Verify that the Windows registry entry exists and points to the correct path
 */
function verifyWindowsRegistryEntry(registryKey: string, expectedPath: string): boolean {
  if (os.platform() !== 'win32') {
    return true; // Skip verification on non-Windows platforms
  }

  const normalizeForCompare = (filePath: string): string => path.normalize(filePath).toLowerCase();

  try {
    const output = execSync(`reg query "${registryKey}" /ve`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const lines = output
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const match = line.match(/REG_SZ\s+(.*)$/i);
      if (!match?.[1]) continue;
      const actualPath = match[1].trim();
      return normalizeForCompare(actualPath) === normalizeForCompare(expectedPath);
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Write node_path.txt and then register user-level Native Messaging host.
 * This is the recommended entry point for development and production registration,
 * as it ensures the Node.js path is captured before registration.
 *
 * @param browsers - Optional list of browsers to register for
 * @returns true if at least one browser was registered successfully
 */
export async function registerUserLevelHostWithNodePath(
  browsers?: BrowserType[],
): Promise<boolean> {
  writeNodePathFile(path.join(__dirname, '..'));
  return tryRegisterUserLevelHost(browsers);
}

/**
 * Try to register a user-level Native Messaging host
 */
export async function tryRegisterUserLevelHost(targetBrowsers?: BrowserType[]): Promise<boolean> {
  try {
    console.log(colorText('Attempting to register user-level Native Messaging host...', 'blue'));

    // 1. Make sure execution permissions are set
    await ensureExecutionPermissions();

    // 2. Determine which browsers to register for
    const browsersToRegister = targetBrowsers || detectInstalledBrowsers();
    if (browsersToRegister.length === 0) {
      // If no browser was detected, register Chrome and Chromium by default
      browsersToRegister.push(BrowserType.CHROME, BrowserType.CHROMIUM);
      console.log(
        colorText('No browsers detected, registering for Chrome and Chromium by default', 'yellow'),
      );
    } else {
      console.log(colorText(`Detected browsers: ${browsersToRegister.join(', ')}`, 'blue'));
    }

    // 3. Create the manifest content
    const manifest = await createManifestContent();

    let successCount = 0;
    const results: { browser: string; success: boolean; error?: string }[] = [];

    // 4. Register for each browser
    for (const browserType of browsersToRegister) {
      const config = getBrowserConfig(browserType);
      console.log(colorText(`\nRegistering for ${config.displayName}...`, 'blue'));

      try {
        // Make sure the directory exists
        await mkdir(path.dirname(config.userManifestPath), { recursive: true });

        // Write the manifest file
        await writeFile(config.userManifestPath, JSON.stringify(manifest, null, 2));
        console.log(colorText(`✓ Manifest written to ${config.userManifestPath}`, 'green'));

        // Windows needs an extra registry entry
        if (os.platform() === 'win32' && config.registryKey) {
          try {
            // Note: no need to manually double the backslashes; the reg command handles Windows paths correctly
            const regCommand = `reg add "${config.registryKey}" /ve /t REG_SZ /d "${config.userManifestPath}" /f`;
            execSync(regCommand, { stdio: 'pipe' });

            if (verifyWindowsRegistryEntry(config.registryKey, config.userManifestPath)) {
              console.log(colorText(`✓ Registry entry created for ${config.displayName}`, 'green'));
            } else {
              throw new Error('Registry verification failed');
            }
          } catch (error) {
            throw new Error(
              `Registry error: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        successCount++;
        results.push({ browser: config.displayName, success: true });
        console.log(colorText(`✓ Successfully registered ${config.displayName}`, 'green'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ browser: config.displayName, success: false, error: message });
        console.log(colorText(`✗ Failed to register ${config.displayName}: ${message}`, 'red'));
      }
    }

    // 5. Report the results
    console.log(colorText('\n===== Registration Summary =====', 'blue'));
    for (const result of results) {
      if (result.success) {
        console.log(colorText(`✓ ${result.browser}: Success`, 'green'));
      } else {
        console.log(colorText(`✗ ${result.browser}: Failed - ${result.error}`, 'red'));
      }
    }

    return successCount > 0;
  } catch (error) {
    console.log(
      colorText(
        `User-level registration failed: ${error instanceof Error ? error.message : String(error)}`,
        'yellow',
      ),
    );
    return false;
  }
}

// Import the is-admin package (only used on Windows)
let isAdmin: () => boolean = () => false;
if (process.platform === 'win32') {
  try {
    isAdmin = require('is-admin');
  } catch (error) {
    console.warn(
      'The is-admin dependency is missing; administrator permission detection may not work on Windows',
    );
    console.warn(error);
  }
}

/**
 * Register the system-level manifest using elevated permissions
 */
export async function registerWithElevatedPermissions(): Promise<void> {
  try {
    console.log(colorText('Attempting to register system-level manifest...', 'blue'));

    // 1. Make sure execution permissions are set
    await ensureExecutionPermissions();

    // 2. Prepare the manifest content
    const manifest = await createManifestContent();

    // 3. Get the system-level manifest path
    const manifestPath = getSystemManifestPath();

    // 4. Create a temporary manifest file
    const tempManifestPath = path.join(os.tmpdir(), `${HOST_NAME}.json`);
    await writeFile(tempManifestPath, JSON.stringify(manifest, null, 2));

    // 5. Detect whether administrator permissions are already available
    const isRoot = process.getuid && process.getuid() === 0; // Unix/Linux/Mac
    const hasAdminRights = process.platform === 'win32' ? isAdmin() : false; // Detect administrator permissions on Windows
    const hasElevatedPermissions = isRoot || hasAdminRights;

    // Prepare the command
    const command =
      os.platform() === 'win32'
        ? `if not exist "${path.dirname(manifestPath)}" mkdir "${path.dirname(manifestPath)}" && copy "${tempManifestPath}" "${manifestPath}"`
        : `mkdir -p "${path.dirname(manifestPath)}" && cp "${tempManifestPath}" "${manifestPath}" && chmod 644 "${manifestPath}"`;

    if (hasElevatedPermissions) {
      // Administrator permissions are already available; run the command directly
      try {
        // Create the directory
        if (!fs.existsSync(path.dirname(manifestPath))) {
          fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        }

        // Copy the file
        fs.copyFileSync(tempManifestPath, manifestPath);

        // Set permissions (non-Windows platforms)
        if (os.platform() !== 'win32') {
          fs.chmodSync(manifestPath, '644');
        }

        console.log(colorText('System-level manifest registration successful!', 'green'));
      } catch (error) {
        console.error(
          colorText(
            `System-level manifest installation failed: ${error instanceof Error ? error.message : String(error)}`,
            'red',
          ),
        );
        throw error;
      }
    } else {
      // No administrator permissions; print manual instructions
      console.log(
        colorText('⚠️ Administrator privileges required for system-level installation', 'yellow'),
      );
      console.log(
        colorText(
          'Please run one of the following commands with administrator privileges:',
          'blue',
        ),
      );

      if (os.platform() === 'win32') {
        console.log(colorText('  1. Open Command Prompt as Administrator and run:', 'blue'));
        console.log(colorText(`     ${command}`, 'cyan'));
      } else {
        console.log(colorText('  1. Run with sudo:', 'blue'));
        console.log(colorText(`     sudo ${command}`, 'cyan'));
      }

      console.log(
        colorText('  2. Or run the registration command with elevated privileges:', 'blue'),
      );
      console.log(colorText(`     sudo ${COMMAND_NAME} register --system`, 'cyan'));

      throw new Error('Administrator privileges required for system-level installation');
    }

    // 6. Windows special handling - set the system-level registry entry
    if (os.platform() === 'win32') {
      const registryKey = `HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
      // Note: no need to manually double the backslashes; the reg command handles Windows paths correctly
      const regCommand = `reg add "${registryKey}" /ve /t REG_SZ /d "${manifestPath}" /f`;

      console.log(colorText(`Creating system registry entry: ${registryKey}`, 'blue'));
      console.log(colorText(`Manifest path: ${manifestPath}`, 'blue'));

      if (hasElevatedPermissions) {
        // Administrator permissions are already available; run the registry command directly
        try {
          execSync(regCommand, { stdio: 'pipe' });

          // Verify that the registry entry was created successfully
          if (verifyWindowsRegistryEntry(registryKey, manifestPath)) {
            console.log(colorText('Windows registry entry created successfully!', 'green'));
          } else {
            console.log(colorText('⚠️ Registry entry created but verification failed', 'yellow'));
          }
        } catch (error) {
          console.error(
            colorText(
              `Windows registry entry creation failed: ${error instanceof Error ? error.message : String(error)}`,
              'red',
            ),
          );
          console.error(colorText(`Command: ${regCommand}`, 'red'));
          throw error;
        }
      } else {
        // No administrator permissions; print manual instructions
        console.log(
          colorText(
            '⚠️ Administrator privileges required for Windows registry modification',
            'yellow',
          ),
        );
        console.log(colorText('Please run the following command as Administrator:', 'blue'));
        console.log(colorText(`  ${regCommand}`, 'cyan'));
        console.log(colorText('Or run the registration command with elevated privileges:', 'blue'));
        console.log(
          colorText(
            `  Run Command Prompt as Administrator and execute: ${COMMAND_NAME} register --system`,
            'cyan',
          ),
        );

        throw new Error('Administrator privileges required for Windows registry modification');
      }
    }
  } catch (error) {
    console.error(
      colorText(
        `Registration failed: ${error instanceof Error ? error.message : String(error)}`,
        'red',
      ),
    );
    throw error;
  }
}
