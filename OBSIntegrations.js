import OBSWebSocket from "obs-websocket-js";
import * as util from './util.js';
import { randomInt } from "node:crypto";
import { subscribers } from "./TwitchIntegrations.js";
import { EventHandler } from './index.js';

export var obsConnected = false;
export var subscriberItems = {};

var broadcasterIcon = false;
var currentScene = "";
const swapScenes = JSON.parse(process.env.SCENE_SWAP)

var obs = new OBSWebSocket();
obs.on('Identified', function hello() {
    obsConnected = true;
    console.log('OBS Connected');
    initialize();
});
obs.on('ExitStarted', function exit() {
    obsConnected = false;
    console.log('OBS Disconnected');
    subscriberItems = {};
    reconnect();
});

async function reconnect(){
    await util.waitSeconds(5)
    autoconnect();
}

obs.on('CurrentProgramSceneChanged', function _(scene){
    currentScene = scene.sceneName
    updateCurrentScene();
})
async function initialize(){
    clearSubItems();
    var scene = await obs.call('GetCurrentProgramScene');
    currentScene = scene.sceneName;
    updateCurrentScene();
}
export async function clearSubItems() {
    const SubItems = await obs.call('GetSceneItemList', { sceneName: 'SubscriberItems' });
    SubItems.sceneItems.forEach(function (value, index, _) {
        obs.call('RemoveInput', { inputUuid: String(value.sourceUuid) });
    });
    subscriberItems = {};
}

async function updateCurrentScene(){
    if(swapScenes.hasOwnProperty(currentScene)){
        //Update Scene
        obs.call('SetCurrentProgramScene', {sceneName: swapScenes[currentScene]});
        currentScene = swapScenes[currentScene];
        return;
    }
}

//Checks if OBS is connected, if not, attempt to connect
async function attemptConnectOBS() {
    if (obsConnected)
        return true;
    try { 
        const { obsWebSocketVersion, negotiatedRpcVersion } = await obs.connect(`ws://${process.env.OBS_WEBSOCKET}:${process.env.OBS_PORT}`, process.env.OBS_USER_KEY, {
            rpcVersion: 1
        });
        //console.log(`Connected to OBS Websocket server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`);
        await util.waitSeconds(.5);
        EventHandler.emit("obsconnect")
        return true;
    }
    catch (err) {
        return false;
    }
}

export async function getObsConnected(timeout = 1000) {
    if(obsConnected) return true;
    return new Promise((resolve, reject) => {
        async function checkCondition(){
            if(obsConnected) resolve(true);
            await(util.waitSeconds(0.1))
            checkCondition();
        }
        setTimeout(() => resolve(false), timeout)
        checkCondition();
    })
}

/**
 *
 * @param {String} inputName Name of the input
 * @param {String} inputKind Type of input
 * @param {Object} inputSettings
 * @param {String} sceneName
 * @param {Boolean} enabled
 * @returns {{String, Number}}
 */
async function createInput(inputName, inputKind = 'image_source', inputSettings = {}, sceneName = 'TestScene', enabled = true) {
    var ItemId;
    try {
        ItemId = await obs.call('CreateInput', { sceneName: sceneName, inputName: inputName, inputKind: inputKind, inputSettings: inputSettings, sceneItemEnabled: enabled });
        var { sceneItemTransform } = await obs.call('GetSceneItemTransform', { sceneName: sceneName, sceneItemId: ItemId.sceneItemId });
        sceneItemTransform.alignment = 5;
        sceneItemTransform.positionX = randomInt(1920);
        sceneItemTransform.positionY = randomInt(1080);
        await obs.call('SetSceneItemTransform', { sceneName: sceneName, sceneItemId: ItemId.sceneItemId, sceneItemTransform: sceneItemTransform });
        return ItemId;
    }
    catch {
        ItemId = { inputUuid: "0", sceneItemId: 0 };
        const ItemList = await obs.call('GetSceneItemList', { sceneName: sceneName });
        ItemList.sceneItems.forEach(function (value, index, _) {
            console.log(value.sourceName);
            if (value.sourceName === inputName) {
                ItemId = { inputUuid: String(value.sourceUuid), sceneItemId: Number(value.sceneItemId) };
            }
        });
    }
    return ItemId;
}
/**
 * 
 * @param {string} chatter 
 * @param {string} sceneName 
 * @param {number} ItemX 
 * @param {number} ItemY 
 * @returns 
 */
export async function moveSubItem(chatter, sceneName = "SubscriberItems", ItemX = randomInt(1750), ItemY = randomInt(950)) {
    if(!subscriberItems[chatter]) return;
    var ItemId = subscriberItems[chatter];
    var { sceneItemTransform } = await obs.call('GetSceneItemTransform', { sceneName: sceneName, sceneItemId: ItemId.sceneItemId });
    if (Number.isNaN(ItemX)) {
        ItemX = 0;
    }
    if (Number.isNaN(ItemY)) {
        ItemY = 0;
    }
    sceneItemTransform.positionX = ItemX;
    sceneItemTransform.positionY = ItemY;
    if(sceneItemTransform.boundsWidth < 1){
        sceneItemTransform.boundsWidth = 1;
    }
    if(sceneItemTransform.boundsHeight < 1){
        sceneItemTransform.boundsHeight = 1;
    }
    await obs.call('SetSceneItemTransform', { sceneName: sceneName, sceneItemId: ItemId.sceneItemId, sceneItemTransform: sceneItemTransform });
}

async function Move(sceneName = "TestScene", sourceName = "", ItemX = 0, ItemY = 0, ItemRot = 0) {
    const { sceneItemId } = await obs.call("GetSceneItemId", { sceneName: "TestScene", sourceName: sourceName });
    var { sceneItemTransform } = await obs.call("GetSceneItemTransform", { sceneName: "TestScene", sceneItemId: sceneItemId });
    sceneItemTransform.positionX = ItemX + Number(sceneItemTransform.positionX);
    sceneItemTransform.positionY = ItemY + Number(sceneItemTransform.positionY);
    sceneItemTransform.rotation = ItemRot + Number(sceneItemTransform.rotation);
    await obs.call("SetSceneItemTransform", { sceneName: sceneName, sceneItemId: sceneItemId, sceneItemTransform: sceneItemTransform });
}
/**
 * 
 * @param {string} sceneName 
 * @param {string} sourceName 
 * @param {number} Id 
 * @param {object} transform 
 * @param {number} rotationChange 
 * @param {number} timeBetweenChange 
 * @param {number} lastTick 
 */
async function spin(sceneName = "TestScene", sourceName = "TestText", Id = null, transform = null, rotationChange = 0.05, timeBetweenChange = 0, lastTick = Date.now() - 1) {
    var dtime = Date.now() - lastTick;
    lastTick = Date.now();
    if (transform == null) {
        if (Id == null) {
            const { sceneItemId } = await obs.call("GetSceneItemId", { sceneName: "TestScene", sourceName: sourceName });
            Id = sceneItemId;
        }
        var { sceneItemTransform } = await obs.call("GetSceneItemTransform", { sceneName: "TestScene", sceneItemId: Id });
        transform = sceneItemTransform;
    }
    if (Number(transform.boundsWidth) <= 0) {
        transform.boundsWidth = 1;
    }
    if (Number(transform.boundsHeight) <= 0) {
        transform.boundsHeight = 1;
    }
    //Transform fetched, change rotation based on delta time
    transform.rotation = Number(transform.rotation) + rotationChange * dtime;
    if (transform.rotation > 360) {
        transform.rotation = 0;
    }
    else if (transform.rotation < 0) {
        transform.rotation = 360;
    }
    await obs.call("SetSceneItemTransform", { sceneName: sceneName, sceneItemId: Id, sceneItemTransform: transform });
    await util.waitSeconds(timeBetweenChange);
    if (transform.rotation != 0) {
        spin(sceneName, sourceName, Id, transform, rotationChange, timeBetweenChange, lastTick);
    }
}
/**
 * 
 * @param {object} number 
 * @param {string} filePath 
 * @returns 
 */
export async function updateIcon(inputID, filePath) {
    var con = await getObsConnected();
    if (!con)
        return;
    var orig = await obs.call('GetInputSettings', { inputUuid: inputID });
    orig.inputSettings.file = filePath;
    obs.call('SetInputSettings', { inputUuid: inputID, inputSettings: orig.inputSettings });
}
/**
 * 
 * @param {string} broadcaster 
 * @param {string} chatter 
 * @param {string} message 
 * @param {[]} badges 
 * @returns 
 */
export async function ObsIntegrations(broadcaster, chatter, message, badges = []) {
    var con = await getObsConnected(1);
    if (!con){
        attemptConnectOBS();
        await util.waitSeconds(.5);
        if(await !getObsConnected(1)) return;
    }
    //OBS connected! Functionality here!
    if (message.toLowerCase().includes("spin")) {
        //spin();
        //spin('TestScene', 'Main Scene');
        const items = await (await obs.call('GetSceneItemList', { sceneName: 'TestScene' })).sceneItems;
        items.forEach(function (value, index, _) {
            spin('TestScene', String(value.sourceName));
        });
        return;
    }
    if (subscribers[chatter]) {
        if (chatter === broadcaster && !broadcasterIcon)
            return;
        if (!subscriberItems[chatter]) {
            let UserItem = await createInput(chatter, 'image_source', { file: `${process.cwd()}${process.env.DEFAULT_EMOTE}` }, 'SubscriberItems');
            if (UserItem == null) {
                console.log('Error getting User Item: Item exists but not in Subscriber Items');
                return;
            }
            subscriberItems[chatter] = UserItem;
        }
    }
}

async function onCommand(broadcaster, chatter, command, badges, args){
    if(command.toLowerCase() != 'move') return;
    //OBS is connected if this statement is true
    if(!subscriberItems[chatter]){
        await util.waitSeconds(1);
        if(!subscriberItems[chatter]){
            return;
        }
    }
    if(args == null || args.length < 2){
        moveSubItem(chatter);
        return;
    }else{
        if(parseFloat(args[0]) && parseFloat(args[1])){
            moveSubItem(chatter, 'SubscriberItems', parseFloat(args[0]), parseFloat(args[1]))
        }else{
            moveSubItem(chatter);
        }
    }
}

export async function changeText(ItemName = 'Throne', ItemText = ''){
    var con = await getObsConnected();
    if(!con) return;
    const {inputSettings} = await obs.call('GetInputSettings', {inputName:ItemName})
    inputSettings.text = ItemText;
    obs.call('SetInputSettings', {inputName: ItemName, inputSettings:inputSettings})
}

export function register(EventHandler){
    //Event Registering
    EventHandler.on('message', ObsIntegrations);
    EventHandler.on('command', onCommand)
    EventHandler.on('quit', Quit);
    autoconnect()
}

export async function SwitchTheme(theme = 'Normal', sceneName = 'BackgroundElements', directory = process.env.THEME_DIRECTORY){
    var con = await getObsConnected(1);
    if (!con){
        attemptConnectOBS();
        await util.waitSeconds(.5);
        if(await !getObsConnected(1)){
            console.log('Failed to connect to OBS.')
            return;
        }
    }
    //Fetch Scene
    const {sceneItems} = await (await obs.call('GetSceneItemList', { sceneName: sceneName }));
    sceneItems.forEach((JsonObject) => {
        if(!JsonObject.inputKind) return;
        if(!JsonObject.inputKind.toLowerCase().includes('image')) return;
        updateIcon(JsonObject.sourceUuid, `${directory}/${theme}/${JsonObject.sourceName}`);
    })
}

async function autoconnect(){
    var attempting = true
    while(attempting){
        attempting = !attemptConnectOBS();
        await util.waitSeconds(5);
    }
}

export function Quit(){
    //Exit functionality
    obs.disconnect();
}