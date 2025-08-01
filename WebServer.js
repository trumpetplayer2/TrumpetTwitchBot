import * as dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';
import express from 'express';
import * as util from './util.js'
import { command } from './index.js';



dotenv.config();

let mcClient;
let mcConnected = false;

const wss = new WebSocketServer({port:8080});
function heartbeat(){
    this.isAlive = true;
    this.ping()
}
wss.on("connection", function connection(ws){
    ws.on("message", function message(data){
        var jsonObj = JSON.parse(data);
        if(jsonObj.Access_Token){
            process.env.TWITCH_OAUTH_TOKEN = jsonObj.Access_Token;
            util.updateEnv('TWITCH_OAUTH_TOKEN', jsonObj.Access_Token);
            console.log('Recieved Twitch Token!')
        }else if(jsonObj.Discord_Token){
            process.env.DISCORD_OAUTH_TOKEN = jsonObj.Discord_Token;
            util.updateEnv('DISCORD_OAUTH_TOKEN', jsonObj.Discord_Token);
            console.log('Recieved Discord Token!');
        }else if(jsonObj.Minecraft){
            //If Minecraft was not connected, set this as the MC connection
            if(!mcConnected){
                mcClient = ws;
                ws.isMinecraft = true;
                mcConnected = true;
                console.log('Minecraft Connected');
            }
        }else if(jsonObj.type){
            switch(jsonObj.type){
                case 'speechrecognition':
                    speechRecognition(ws, jsonObj.opCode, jsonObj.data)
                    return;
                default:
                    console.log(`Received a packet from ${jsonObj.type}`);
                    return;
            }
        }
        else{
            console.log(jsonObj);
        }
    });
    ws.on("pong", heartbeat);
    ws.on('close', disconnect);
});

async function speechRecognition(ws, opCode, data){
    console.log(data);
    switch(opCode){
        case 1:
            ws.send(JSON.stringify({"opCode":0, "data":{"text":"Received"}}))
            return;
        case 2:
            //Socket Closed
            return;
        case 3:
            ws.send(JSON.stringify({"opCode":0, "data":{"text":"Received"}}))
            //Socket Text Message
            const msg = data.text;
            //console.log(msg);
            command(msg);
            return;
        case 4:
            ws.send(JSON.stringify({"opCode":0, "data":{"text":"Received"}}))
            //Socket sent data
            console.log(data);
            return;
            
    }
}

async function disconnect(){
    if(this.isMinecraft === true){
        mcDisconnect();
    }
}

async function mcDisconnect(){
    mcConnected = false;
    console.log('Minecraft Disconnected');
}

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) {
        return ws.close(1001, "Websocket Timed out");
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 15 * 1000);

wss.on('close', function close() {
  clearInterval(interval);
});

var app = express();
var server = http.createServer(app);
app.get('/', function(req, res){
    res.sendFile('public/index.html', { root: process.cwd()});
})

async function minecraftIntegration(broadcaster, chatter, message){
    if(!mcConnected) return;
    mcClient.send(broadcaster + "," + chatter + "," + message);
}

server.listen(8081);

export function Quit(){
    //Exit functionality here
    wss.close();
}

export function register(EventHandler){
    EventHandler.on('message', minecraftIntegration);
    EventHandler.on('quit', Quit);
}