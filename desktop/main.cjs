const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEV = process.env.HAUSI_DEV === '1';
const PORT = 4789;
const DEFAULT_HOTKEY = 'CommandOrControl+Alt+H';
const BUILD_DIR = app.isPackaged
	? path.join(process.resourcesPath, 'web-build')
	: path.resolve(__dirname, '../web/build');

let baseUrl = DEV ? 'http://localhost:5180' : `http://127.0.0.1:${PORT}`;
let mainWindow = null;
let captureWindow = null;
let tray = null;
let quitting = false;

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.json': 'application/json',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain'
};

function settingsPath() {
	return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
	try {
		return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
	} catch {
		return {};
	}
}

function writeSettings(data) {
	fs.writeFileSync(settingsPath(), JSON.stringify(data));
}

function currentHotkey() {
	return readSettings().hotkey || DEFAULT_HOTKEY;
}

function applyHotkey(accel) {
	globalShortcut.unregisterAll();
	if (globalShortcut.register(accel, openCapture)) return accel;
	globalShortcut.register(DEFAULT_HOTKEY, openCapture);
	return DEFAULT_HOTKEY;
}

function startStaticServer() {
	return new Promise((resolve) => {
		const server = http.createServer((request, response) => {
			const url = new URL(request.url ?? '/', baseUrl);
			const relative = decodeURIComponent(url.pathname).replace(/^[/\\]+/, '');
			let file = path.resolve(BUILD_DIR, relative);
			if (!file.startsWith(BUILD_DIR)) {
				response.writeHead(403);
				response.end();
				return;
			}
			if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
				file = path.join(BUILD_DIR, 'index.html');
			}
			response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
			fs.createReadStream(file).pipe(response);
		});
		server.listen(PORT, '127.0.0.1', () => resolve());
	});
}

function createMain() {
	mainWindow = new BrowserWindow({
		width: 1180,
		height: 820,
		minWidth: 880,
		minHeight: 640,
		title: 'Hausi',
		autoHideMenuBar: true,
		backgroundColor: '#111111',
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true
		}
	});
	mainWindow.loadURL(`${baseUrl}/app`);
	mainWindow.on('close', (event) => {
		if (quitting) return;
		event.preventDefault();
		mainWindow.hide();
	});
}

function showMain() {
	if (!mainWindow || mainWindow.isDestroyed()) createMain();
	if (mainWindow.isMinimized()) mainWindow.restore();
	mainWindow.show();
	mainWindow.focus();
}

function createTray() {
	const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png')).resize({ width: 16, height: 16 });
	tray = new Tray(icon);
	tray.setToolTip('Hausi');
	const menu = Menu.buildFromTemplate([
		{ label: 'Öffnen', click: showMain },
		{ type: 'separator' },
		{
			label: 'Beenden',
			click: () => {
				quitting = true;
				app.quit();
			}
		}
	]);
	tray.on('click', showMain);
	tray.on('right-click', () => tray.popUpContextMenu(menu));
}

function openCapture() {
	if (captureWindow && !captureWindow.isDestroyed()) {
		captureWindow.show();
		captureWindow.focus();
		return;
	}
	captureWindow = new BrowserWindow({
		width: 680,
		height: 560,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		resizable: false,
		skipTaskbar: true,
		backgroundColor: '#00000000',
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true
		}
	});
	captureWindow.loadURL(`${baseUrl}/capture`);
	captureWindow.on('closed', () => {
		captureWindow = null;
	});
}

ipcMain.on('open-capture', openCapture);
ipcMain.on('close-capture', () => {
	if (captureWindow && !captureWindow.isDestroyed()) captureWindow.close();
});
ipcMain.handle('get-hotkey', () => currentHotkey());
ipcMain.handle('set-hotkey', (_event, value) => {
	const used = applyHotkey(String(value || DEFAULT_HOTKEY));
	writeSettings({ ...readSettings(), hotkey: used });
	return used;
});

app.whenReady().then(async () => {
	Menu.setApplicationMenu(null);
	if (!DEV) {
		if (!fs.existsSync(BUILD_DIR)) {
			baseUrl = 'http://localhost:5180';
		} else {
			await startStaticServer();
		}
	}
	createMain();
	createTray();
	applyHotkey(currentHotkey());
	if (app.isPackaged) {
		try {
			const { autoUpdater } = require('electron-updater');
			autoUpdater.checkForUpdatesAndNotify();
		} catch {
			/* Dev ohne Packer */
		}
	}
});

app.on('before-quit', () => {
	quitting = true;
});

app.on('will-quit', () => {
	globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
	/* Fenster schließen legt Hausi in den Infobereich, beendet die App nicht. */
});
