const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEV = process.env.HAUSI_DEV === '1';
const PORT = 4789;
const BUILD_DIR = path.resolve(__dirname, '../web/build');

let baseUrl = DEV ? 'http://localhost:5180' : `http://127.0.0.1:${PORT}`;
let mainWindow = null;
let captureWindow = null;

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
		backgroundColor: '#f6f1e7',
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true
		}
	});
	mainWindow.loadURL(`${baseUrl}/app`);
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

app.whenReady().then(async () => {
	if (!DEV) {
		if (!fs.existsSync(BUILD_DIR)) {
			baseUrl = 'http://localhost:5180';
		} else {
			await startStaticServer();
		}
	}
	createMain();
	globalShortcut.register('CommandOrControl+Alt+H', openCapture);
});

app.on('will-quit', () => {
	globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
