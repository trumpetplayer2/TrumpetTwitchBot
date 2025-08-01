import * as dotenv from 'dotenv';
import open from 'open';
import WebSocket from 'ws';
import * as main from './index.js'

dotenv.config();

const scopes = ['identify', 'messages.read', 'bot', 'voice', 'presences.read', 'guilds', 'guilds.channels.read', 'webhook.incoming'];
var active = false;
const reauth = process.env.DISCORD_OAUTH_TOKEN;
var identified = false;
var interval;
async function getWebsocketURL(){
    const response = await fetch('https://discord.com/api/v10/gateway/bot', {
    method: 'GET',
    headers: {
        'Authorization': `Bot ${process.env.DISCORD_CLIENT_TOKEN}`
    }
    })
    const responseData = await response.json();
    return responseData.url;
}
var connectionInfo;
const discord = new WebSocket(`${await getWebsocketURL()}?v=10&encoding=json`)
var seq = 0;
discord.addEventListener('message', async (event) => {
    const JsonObject = JSON.parse(event.data);
    const type = JsonObject.t;
    const sequence = JsonObject.s;
    const opCode = JsonObject.op;
    const data = JsonObject.d;
    switch(opCode){
        case 1:
            ping(sequence);
            break;
        case 0:
            discordEvent(type, data);
            break;
        case 10:
            clearInterval(interval);
            ping(sequence);
            interval = setInterval(ping, data.heartbeat_interval)
            return;
        case 11:
            if(!identified){
            //Identify with intents
            identify();
            identified = true;
            }
            seq = sequence
            break;
        default:
            console.log(`Unknown OpCode (${opCode})`);
            console.log(JsonObject);
    }
});

function identify(){
    const intents = parseInt('1111000000001',2)
    const data = {
        'token': process.env.DISCORD_CLIENT_TOKEN,
        'properties': {
            'os': 'Windows',
            'browser': 'Trumpetbot',
            'device': 'Trumpetbot'
        },
        'presence': {
            'activities':[{
                'name': "Hiding, you don't see me",
                'type': 0
            }],
            'status': 'online',
            'since': Date.now(),
            'afk': false
        },
        'intents': intents
    }

    discord.send(JSON.stringify({
        'op': 2,
        'd': data
    }))
}

function ping(sequence = seq){
    discord.send(JSON.stringify({'op': 1, 'd':sequence}));
}

function pong(){
    discord.send(JSON.stringify({'op': 11, 'd':sequence}));
}

discord.on('close', (code, reason) => {
    clearInterval(interval);
})

if(reauth){
    generateOAuth();
}

function generateOAuth(){
    const redirectURI = process.env.REDIRECT_URI;
    var scope = '';
    for(let i = 0; i < scopes.length; i++){
        scope += scopes[i];
        if(i < scopes.length -1){
            scope += '+';
        }
    }
    const permissionCode = 8;
    const authorizationURL = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${permissionCode}&response_type=code&redirect_uri=${process.env.REDIRECT_URI}&scope=${scope}`
    open(authorizationURL, {newInstance: true});
}

async function discordEvent(type, data){
    switch(type.toLowerCase()){
        case 'ready':
            console.log('Discord Bot Ready');
            connectionInfo = data;
            break;
        case 'guild_create':
            console.log(`Bot Connected to ${data.name} Discord Server`)
            break;
        case 'presence_update':
            return;
        case 'message_create':
            discordMessageEvent(data);
            break;
    }
}

async function discordMessageEvent(data){
    const user = data.author.username;
    const nick = data.member.nick;
    const channel = data.channel_id;
    const guild = data.guild_id;
    const roles = data.member.roles;
    const msg = data.content;
    main.EventHandler.emit('discordmessage', user, nick, channel, guild, roles, msg, data)
}

async function reply(user, nick, channel, guild, roles, msg){
    if(channel != 657347208466923540) return;

}

export function Quit(){
    //Exit Functionality Here
    discord.close(1000);
}

export function register(EventHandler){
    //EventHandler.on('discordmessage', )
    EventHandler.on('quit', Quit);
}