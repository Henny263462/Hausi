const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hausiDesktop', {
	openCapture: () => ipcRenderer.send('open-capture'),
	closeCapture: () => ipcRenderer.send('close-capture')
});
