/**
* Tip:    主进程
* Author: haoluo
* Data:   2020-02-25
**/
const {
    BrowserWindow,
    dialog
} = require("electron");
const electron = require("electron");
const process = require("process");
const url = require("url");
const path = require("path");
const cookie = require('cookie');
const devServerConfig = require('@config/devServerConfig.js');

const devMode = process.env.NODE_ENV === "development";
let mainWindow = null;

const filter = {
    urls: ['http://*.kakayang.cn/*']
};
//创建窗口
function createWindow() {
    // 首页路径，file协议,pathToFileURL得到编码过的URL
    let filePath = url.pathToFileURL(path.join(__dirname, 'index.html')).href;
    let indexUrl = `http://${devServerConfig.url}:${devServerConfig.port}/`;
    let winW = electron.screen.getPrimaryDisplay().workAreaSize.width,
        winH = electron.screen.getPrimaryDisplay().workAreaSize.height;
    let config = {
        title: "electron-vue-template",
        width: winW <= 1240 ? winW : 1240,
        height: winH <= 730 ? winH : 730,
        minWidth: winW <= 1240 ? winW : 1240,
        minHeight: winH <= 730 ? winH : 730,
        offscreen: true,
        show: true,
        center: true,
        frame: false,  //去掉窗口边框
        autoHideMenuBar: true, //隐藏菜单栏
        titleBarStyle: 'customButtonsOnHover',
        simpleFullscreen: true,
        resizable: process.platform === 'darwin', //可否调整大小
        movable: true, //可否移动
        minimizable: true, //可否最小化
        maximizable: true, //可否最大化
        fullscreen: false, //MAC下是否可以全屏
        skipTaskbar: false, //在任务栏中显示窗口
        acceptFirstMouse: true, //是否允许单击页面来激活窗口
        transparent: process.platform === 'darwin', //允许透明
        opacity: 1,//设置窗口初始的不透明度
        closable: true,
        backgroundColor: '#fff',
        allowRunningInsecureContent: true,//允许一个 https 页面运行 http url 里的资源
        webPreferences: {
            devTools: true, //是否打开调试模式
            webSecurity: false,//禁用安全策略
            allowDisplayingInsecureContent: true,//允许一个使用 https的界面来展示由 http URLs 传过来的资源
            allowRunningInsecureContent: true, //允许一个 https 页面运行 http url 里的资源
            nodeIntegration: true//5.x以上版本，默认无法在渲染进程引入node模块，需要这里设置为true
        }
    };
    // 增加session隔离配置
    config.webPreferences.partition = `persist:${Date.now()}${Math.random()}`;
    mainWindow = new BrowserWindow(config);
    global.windowIds.main = mainWindow.webContents.id;
    // 开发环境使用http协议，生产环境使用file协议
    mainWindow.loadURL(devMode ? encodeURI(indexUrl) : filePath);

    //监听关闭
    mainWindow.on('closed', function () {
        mainWindow = null;
    }).on('close', function (event) {
        mainWindow.send("close-window-render");
        event.preventDefault();
    }).on('ready-to-show', function () {
        mainWindow.show();
    });

    try {
        if (mainWindow.webContents.debugger.isAttached()) mainWindow.webContents.debugger.detach("1.1");
        mainWindow.webContents.debugger.attach("1.1");
        mainWindow.webContents.debugger.sendCommand("Network.enable");
    } catch (err) {
        console.log("无法启动调试", err);
        dialog.showErrorBox("get", "无法启动调试");
    }
    // 拦截请求并处理cookie
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(filter, onBeforeSendHeaders);
    mainWindow.webContents.session.webRequest.onHeadersReceived(filter, onHeadersReceived);
    return mainWindow;
}
function onBeforeSendHeaders(details, callback) {
    if (details.requestHeaders) {
        details.requestHeaders['Cookie'] = global.cookie;
        details.requestHeaders['Origin'] = details.url;
        details.requestHeaders['Referer'] = details.url;
    }
    callback({ requestHeaders: details.requestHeaders });
}
function onHeadersReceived(details, callback) {
    let cookieArr = [];
    for (let name in details.responseHeaders) {
        if (name.toLocaleLowerCase() === 'Set-Cookie'.toLocaleLowerCase()) {
            cookieArr = details.responseHeaders[name];
        }
    }
    let webCookie = "";
    cookieArr instanceof Array && cookieArr.forEach(cookieItem => {
        webCookie += cookieItem;
    });
    let webCookieObj = cookie.parse(webCookie);
    let localCookieObj = cookie.parse(global.cookie || '');
    let newCookie = Object.assign({}, localCookieObj, webCookieObj);
    let cookieStr = "";
    for (let name in newCookie) {
        cookieStr += cookie.serialize(name, newCookie[name]) + ";";
    }
    global.cookie = cookieStr;
    callback({ response: details.responseHeaders, statusLine: details.statusLine });
}
module.exports = {
    create(_callback) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.destroy();
        }
        mainWindow = createWindow();
        if (_callback instanceof Function) _callback(mainWindow);
        return mainWindow;
    }
}
