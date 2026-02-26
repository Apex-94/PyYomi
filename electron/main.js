const path = require('path');
const { spawn, execFileSync } = require('child_process');

const electronModule = require('electron');
if (typeof electronModule === 'string') {
  // Guard against ELECTRON_RUN_AS_NODE leaking into app launch.
  const relaunchedEnv = { ...process.env };
  delete relaunchedEnv.ELECTRON_RUN_AS_NODE;
  const relaunched = spawn(electronModule, process.argv.slice(1), {
    env: relaunchedEnv,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  relaunched.unref();
  process.exit(0);
}

const { app, BrowserWindow, ipcMain, shell, dialog } = electronModule;
const fs = require('fs');
const http = require('http');
const net = require('net');

let mainWindow;
let backendProcess;
let frontendProcess;
let activeBackendUrl = null;

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const BROKEN_PIPE_PATTERN = /(BrokenPipeError|broken pipe|EPIPE)/i;

function isBrokenPipeError(value) {
  return BROKEN_PIPE_PATTERN.test(String(value || ''));
}

function getBackendDir() {
  const candidates = [
    path.join(process.resourcesPath || '', 'backend'),
    path.join(__dirname, '..', 'backend'),
    path.join(__dirname, '..', '..', 'backend'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[1];
}

function getBackendPython(backendDir) {
  const venvPath = path.join(backendDir, 'venv', 'Scripts', 'python.exe');
  const altVenvPath = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPath)) return venvPath;
  if (fs.existsSync(altVenvPath)) return altVenvPath;
  return 'python';
}

function getBackendExecutablePath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'backend', 'pyyomi-backend.exe'),
    path.join(__dirname, '..', 'backend', 'dist', 'pyyomi-backend.exe'),
    path.join(__dirname, '..', '..', 'backend', 'dist', 'pyyomi-backend.exe'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function waitForBackendReady(url, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
          return;
        }
        retry();
      });

      req.on('error', retry);
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(check, 500);
    };

    check();
  });
}

function findAvailablePort(start = 8000, end = 8100) {
  return new Promise((resolve) => {
    let port = start;

    const tryNext = () => {
      if (port > end) {
        resolve(null);
        return;
      }

      const server = net.createServer();
      server.once('error', () => {
        port += 1;
        tryNext();
      });
      server.once('listening', () => {
        const selected = port;
        server.close(() => resolve(selected));
      });
      server.listen(port, '127.0.0.1');
    };

    tryNext();
  });
}

function terminateManagedProcess(childProcess, name) {
  if (!childProcess || typeof childProcess.kill !== 'function') return;
  const pid = childProcess.pid;

  try {
    if (isWindows && pid) {
      // Windows kill must be done as a process tree, otherwise children can be orphaned.
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      return;
    }

    childProcess.kill('SIGTERM');
  } catch (error) {
    try {
      childProcess.kill('SIGKILL');
    } catch (_) {
      console.warn(`Failed to terminate ${name} process:`, String(error?.message || error));
    }
  }
}

function stopManagedProcesses() {
  terminateManagedProcess(backendProcess, 'backend');
  terminateManagedProcess(frontendProcess, 'frontend');
  backendProcess = null;
  frontendProcess = null;
}

function startBackend() {
  return new Promise(async (resolve) => {
    const selectedPort = await findAvailablePort(8000, 8100);
    if (!selectedPort) {
      console.error('No available backend port found in range 8000-8100');
      resolve(false);
      return;
    }

    const backendUrl = `http://127.0.0.1:${selectedPort}`;
    const healthUrl = `${backendUrl}/health`;
    const dataDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'data')
      : path.join(getBackendDir(), 'data');
    const logsDir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });
    const electronLogPath = path.join(logsDir, 'electron-main.log');
    const appendElectronLog = (line) => {
      const text = `[${new Date().toISOString()}] ${line}\n`;
      fs.appendFileSync(electronLogPath, text, { encoding: 'utf8' });
    };

    const bundledBackendExe = getBackendExecutablePath();
    const canUseBundledExe = Boolean(bundledBackendExe && app.isPackaged);
    const backendDir = getBackendDir();
    const backendCommand = canUseBundledExe ? bundledBackendExe : getBackendPython(backendDir);
    const backendArgs = canUseBundledExe
      ? ['--port', String(selectedPort), '--data-dir', dataDir]
      : ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(selectedPort)];

    console.log('Starting backend command:', backendCommand);
    console.log('Backend mode:', canUseBundledExe ? 'bundled-exe' : 'python-uvicorn');
    appendElectronLog(`Starting backend: ${backendCommand} ${backendArgs.join(' ')}`);
    backendProcess = spawn(
      backendCommand,
      backendArgs,
      {
        cwd: backendDir,
        stdio: 'pipe',
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          PYYOMI_DISABLE_CONSOLE_LOG: '1',
        },
      }
    );

    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Backend:', output);
      appendElectronLog(`[backend:stdout] ${output.trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (isBrokenPipeError(output)) {
        console.warn('Backend stream warning ignored:', output.trim());
        appendElectronLog(`[backend:stderr:ignored] ${output.trim()}`);
        return;
      }
      console.error('Backend Error:', output);
      appendElectronLog(`[backend:stderr] ${output.trim()}`);
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      appendElectronLog(`[backend:error] ${String(err?.message || err)}`);
      resolve(false);
    });

    backendProcess.on('exit', (code, signal) => {
      appendElectronLog(`[backend:exit] code=${String(code)} signal=${String(signal)}`);
      backendProcess = null;
    });

    const ready = await waitForBackendReady(healthUrl, 20000);
    if (!ready) {
      console.error('Backend health check failed:', healthUrl);
      appendElectronLog(`Backend health check failed: ${healthUrl}`);
      stopManagedProcesses();
      resolve(false);
      return;
    }
    appendElectronLog(`Backend ready: ${backendUrl}`);
    activeBackendUrl = backendUrl;
    resolve(true);
  });
}

function findBundledFrontendDist() {
  const candidates = [
    path.join(process.resourcesPath || '', 'frontend', 'dist'),
    path.join(__dirname, 'frontend', 'dist'),
    path.join(path.dirname(app.getAppPath()), 'frontend', 'dist'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function getDevFrontendDir() {
  const candidates = [
    path.join(__dirname, '..', '..', 'frontend'),
    path.join(__dirname, '..', 'frontend'),
  ];
  return candidates.find((p) => fs.existsSync(path.join(p, 'package.json')));
}

function startFrontend() {
  return new Promise((resolve) => {
    console.log('Starting frontend...');

    // In packaged builds, serve bundled static assets.
    // In development, always run Vite dev server to avoid stale dist bundles.
    if (app.isPackaged) {
      const distPath = findBundledFrontendDist();
      if (distPath) {
        console.log('Using bundled frontend dist:', distPath);
        startStaticServer(distPath, 3000).then(resolve);
        return;
      }
    }

    const frontendDir = getDevFrontendDir();
    if (!frontendDir) {
      console.error('Frontend directory not found for development mode.');
      resolve(false);
      return;
    }

    const nodeModulesPath = path.join(frontendDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('Installing frontend dependencies...');
      const installProcess = spawn(npmCommand, ['install'], {
        cwd: frontendDir,
        stdio: 'inherit',
        shell: false,
        windowsHide: true,
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          startFrontendDev(frontendDir, resolve);
        } else {
          resolve(false);
        }
      });
      installProcess.on('error', (err) => {
        console.error('Failed to install frontend dependencies:', err);
        resolve(false);
      });
      return;
    }

    startFrontendDev(frontendDir, resolve);
  });
}

function startFrontendDev(frontendDir, resolve) {
  frontendProcess = spawn(npmCommand, ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '3000'], {
    cwd: frontendDir,
    stdio: 'pipe',
    shell: false,
    windowsHide: true,
    env: { ...process.env, BROWSER: 'none' },
  });

  let started = false;

  frontendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Frontend:', output);
    if (output.includes('Local:') && !started) {
      started = true;
      resolve(true);
    }
  });

  frontendProcess.stderr.on('data', (data) => {
    console.error('Frontend Error:', data.toString());
  });

  frontendProcess.on('error', (err) => {
    console.error('Failed to start frontend:', err);
    resolve(false);
  });

  setTimeout(() => {
    if (!started) {
      console.log('Frontend startup timeout, proceeding anyway...');
      resolve(true);
    }
  }, 30000);
}

function startStaticServer(dir, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url || '/';
      if (reqPath === '/') reqPath = '/index.html';
      let filePath = path.join(dir, reqPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(dir, 'index.html');
      }

      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Server Error');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Static server running at http://127.0.0.1:${port}`);
      resolve(true);
    });

    frontendProcess = {
      kill: () => server.close(),
    };
  });
}

async function createWindow() {
  console.log('Starting services...');
  const backendOk = await startBackend();
  console.log('Backend started:', backendOk);
  if (!backendOk || !activeBackendUrl) {
    dialog.showErrorBox(
      'Backend Startup Failed',
      `PyYomi backend failed to start.\nCheck logs at:\n${path.join(app.getPath('userData'), 'logs', 'electron-main.log')}\n${path.join(app.getPath('userData'), 'data', 'backend.log')}`
    );
    app.quit();
    return;
  }
  process.env.PYYOMI_BACKEND_URL = activeBackendUrl;

  const frontendOk = await startFrontend();
  console.log('Frontend started:', frontendOk);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'assets', 'icons', 'icon.ico'),
    show: false,
    backgroundColor: '#1a1a2e',
  });

  mainWindow.setMenuBarVisibility(false);

  const frontendUrl = 'http://localhost:3000';
  console.log('Loading:', frontendUrl);
  mainWindow.loadURL(frontendUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const isTrackerOAuthHost =
        host === 'anilist.co' ||
        host === 'myanimelist.net' ||
        host.endsWith('.anilist.co') ||
        host.endsWith('.myanimelist.net');
      const isLocalCallbackHost = host === '127.0.0.1' || host === 'localhost';
      const isTrackerCallbackPath = parsed.pathname.startsWith('/tracker/callback/');

      // Keep tracker OAuth and callback flow inside Electron so popup and opener
      // share the same backend context and postMessage bridge.
      if (isTrackerOAuthHost || (isLocalCallbackHost && isTrackerCallbackPath)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 640,
            height: 760,
            parent: mainWindow,
            modal: false,
            autoHideMenuBar: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              preload: path.join(__dirname, 'preload.js'),
            },
          },
        };
      }
    } catch (error) {
      console.warn('Invalid popup URL, opening externally:', url, error);
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopManagedProcesses();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopManagedProcesses();
});

app.on('will-quit', () => {
  stopManagedProcesses();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('get-app-path', (event) => {
  event.reply('app-path', app.getAppPath());
});

ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('select-download-path', async () => {
  if (!mainWindow) {
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0] || null;
});

process.on('uncaughtException', (error) => {
  if (isBrokenPipeError(error?.message)) {
    console.warn('Suppressed uncaught broken-pipe exception:', error.message);
    return;
  }
  console.error('Uncaught exception in Electron main process:', error);
});

process.on('unhandledRejection', (reason) => {
  if (isBrokenPipeError(reason)) {
    console.warn('Suppressed unhandled broken-pipe rejection:', String(reason));
    return;
  }
  console.error('Unhandled rejection in Electron main process:', reason);
});
