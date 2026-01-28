import * as dotenv from 'dotenv';
import * as util from './util.js'
import * as obs from './OBSIntegrations.js'
import { EventHandler } from './index.js';
import open from 'open';
import WebSocket from 'ws';

dotenv.config();
const scopes = ['bits:read', 'channel:read:redemptions', 'channel:manage:redemptions', 'user:bot', 'user:read:chat', 'channel:bot', 'channel:read:subscriptions', 'user:write:chat', 'channel:manage:vips', 'moderator:manage:banned_users', 'moderation:read', 'channel:manage:polls'];

let generatedOAuth = false;
let websocketSessionID;
export let subscribers = {};
export let vips = {};
export let mods = {};
export let polls = [];

const commandPrefix = process.env.COMMAND_PREFIX;
const regex = new RegExp(`^${commandPrefix}([a-zA-Z0-9]+)(?:\W+)?(.*)?`);
let primaryBroadcasterID;
const twitch = new WebSocket("wss://eventsub.wss.twitch.tv/ws");

var _reward_id = JSON.parse(process.env.REWARD_ID)

export async function generateOAuth(){
    generatedOAuth = true;
    const redirectURI = process.env.REDIRECT_URI;
    var scope = '';
    for(let i = 0; i < scopes.length; i++){
        scope += scopes[i];
        if(i < scopes.length -1){
            scope += '+';
        }
    }
    const authorizationURL = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${redirectURI}&response_type=token&scope=${scope}`
    await open(authorizationURL, {popup: true});
}
const broadcasterID = {
    trumpet: '154742177',
    lemon: '115086853',
    tea: '762548538'
}

twitch.addEventListener('message', async (event)=>{
    const JsonObject = JSON.parse(event.data);
    const data = JsonObject.metadata;
    //console.log(data.message_type);
    if(data.message_type == "session_welcome"){
        websocketSessionID = JsonObject.payload.session.id
        //We wait for first subscription to finish to make sure access token exists
        await subscribeToEvent('channel.chat.message','1', {"broadcaster_user_id": broadcasterID.trumpet, 'user_id': process.env.TWITCH_USER_ID})
        //None of the subsequent ones should need checked
        subscribeToEvent('channel.channel_points_custom_reward_redemption.add', '1', {"broadcaster_user_id": broadcasterID.trumpet});
        subscribeToEvent('channel.subscribe', '1', {"broadcaster_user_id": broadcasterID.trumpet});
        subscribeToEvent('channel.poll.end', '1', {"broadcaster_user_id": broadcasterID.trumpet})
        fetchLists();
        toggleAllChannelpoints(true);
    }
    if(data.message_type == "session_keepalive"){}
    if(data.message_type == "notification"){
        NotificationMessage(JsonObject);
    }
    if(data.message_type == "revocation"){
        console.log(`Subscription Revoked`);
        console.log(JsonObject.message);
        if(JsonObject.message.includes('OAUTH')){
            generateOAuth();
        }
    }
    if(event.data.includes('PING')) twitch.send('PONG');
});

async function fetchLists(){
    try{
    primaryBroadcasterID = await fetchUserID(process.env.PRIMARY_BROADCASTER);

    fetchSubscriberList(primaryBroadcasterID);
    fetchVIPList(primaryBroadcasterID);
    fetchModList(primaryBroadcasterID);
    }catch{
        await util.waitSeconds(1);
        fetchLists();
    }
}

async function subscribeToEvent(eventType, version, condition, repeat = false){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    //Data - This will be the -d in the curl
    const data = {
        //Json data
        'type': eventType,
        'version': version,
        'condition': condition,
        'transport':{
            'method': 'websocket',
            'session_id': websocketSessionID
        }
    };
    const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID,
            'Content-Type':'application/json'
        },
        body: JSON.stringify(data)
    });

    const responseData = await response.json();
    if(responseData.error && !generatedOAuth){
        if(responseData.error == 'Unauthorized'){
            await generateOAuth();
            subscribeToEvent(eventType, version, condition);
        }
    }
}

export async function fetchUserID(name){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    const response = await fetch(`https://api.twitch.tv/helix/users?login=${name}`, {
        method: 'GET',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID,
        }
    })
    const responseData = await response.json();
    if(!responseData.data) return;
    if(responseData.data[0]){
        return responseData.data[0].id;
    }else{
        return null;
    }
}

export async function timeoutUser(user_id, time = 10, reason = "N/A - Twitch Bot", broadcaster_id = primaryBroadcasterID){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    const data = {
        "data":{
            //Json data
            'user_id': user_id,
            'duration': time,
            'reason': reason
        }
    };
    const response = await fetch(`https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${broadcaster_id}&moderator_id=${broadcaster_id}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID,
            'Content-Type':'application/json'
        },
        body: JSON.stringify(data)
    });
    const responseData = await response.json();
}
export async function sendChatMessage(message, broadcaster_id = primaryBroadcasterID){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    const sender_id = process.env.TWITCH_USER_ID;
    const data = {
        "broadcaster_id": broadcaster_id,
        "sender_id": sender_id,
        "message": message
    }
    const response = await fetch(`https://api.twitch.tv/helix/chat/messages`, {
        method: 'POST',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID,
            'Content-Type':'application/json'
        },
        body: JSON.stringify(data)
    })
    const responseData = await response.json();
}

export async function createPoll(title, choices = [{title:"A"},{title:"B"}], duration = 60, cpVotes = false, cpPerVote = 100, broadcaster_id = primaryBroadcasterID){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    var data = {
        "broadcaster_id": broadcaster_id,
        "title": title,
        "choices": choices,
        "duration": duration
    }
    if(cpVotes){
        data.channel_points_voting_enabled = cpVotes;
        data.channel_points_per_vote = cpPerVote;
    }
    const response = await fetch(`https://api.twitch.tv/helix/polls`, {
        method: 'POST',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID,
            'Content-Type':'application/json'
        },
        body: JSON.stringify(data)
    })
    const responseData = await response.json();
    switch(response.status){
        case 200:
            polls.push(responseData.data[0].id)
            console.log(`Started Poll "${title}"`)
            return responseData.data[0].id;
        default:
            console.log(`Recieved code ${response.status}.`)
            console.log(responseData);
    }
}

export async function removeVIP(chatter, broadcaster_id = primaryBroadcasterID){
    var chatterId = await fetchUserID(chatter);
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    const {status} = fetch(`https://api.twitch.tv/helix/channels/vips?broadcaster_id=${broadcaster_id}&user_id=${chatterId}`, {
        method: 'DELETE',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID
        }
    })
    switch(status){
        case 204:
            delete vips[chatter];
            return true;
        default:
            console.log(`Code: ${status}, Failed to remove from VIP List`)
            return false;
    }
}

export async function addVIP(chatter, broadcaster_id = primaryBroadcasterID){
    //Chatter is a VIP, return
    var chatterId = await fetchUserID(chatter);
    if(vips[chatterId]) return false;
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    const {status} = await fetch(`https://api.twitch.tv/helix/channels/vips?broadcaster_id=${broadcaster_id}&user_id=${chatterId}`, {
        method: 'POST',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID
        }
    })
    switch(status){
        case 204: 
            vips[chatter] = chatterId;
            return true;
        case 422:
            //Probably a mod
            return false;
        case 409:
            console.warn("Out of VIP Slots, did something break?")
            return false;
        default:
            console.log(`Code: ${status}, Failed to add to VIP list`)
            return false;
    }
}

async function fetchVIPList(broadcaster_id){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    const response = await fetch(`https://api.twitch.tv/helix/channels/vips?broadcaster_id=${broadcaster_id}`, {
        method: 'GET',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID
        }
    })
    const responseData = await response.json();
    if(!responseData.data) return;
    responseData.data.forEach(function (entry, index){
        vips[entry.user_name] = entry.user_id;
    })
}

async function fetchModList(broadcaster_id){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    const response = await fetch(`https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${broadcaster_id}`, {
        method: 'GET',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID
        }
    })
    const responseData = await response.json();
    if(!responseData.data) return;
    responseData.data.forEach(function (entry, index){
        mods[entry.user_name] = entry.user_id;
    })
}

async function toggleReward(broadcaster_id, reward_id, state){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    var data = {
        "is_enabled": state
    }
    const response = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${broadcaster_id}&id=${reward_id}`, {
        method: 'PATCH',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID,
            'Content-Type':'application/json'
        },
        body: JSON.stringify(data)
    })
    const responseData = await response.json();
    switch(responseData.status){
        case 404: 
            if(state){
                addReward(broadcaster_id, _reward_id[reward_id])
                delete _reward_id[reward_id]
                console.log(reward_id)
            }
            return;
    }
}

async function addReward(broadcaster_id, reward){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    var data = {
        "title": reward.name,
        "cost": reward.cost,
        "prompt": reward.prompt,
        "is_user_input_required": reward.use_input
    }
    const response = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${broadcaster_id}`, {
        method: 'POST',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID,
            'Content-Type':'application/json'
        },
        body: JSON.stringify(data)
    })
    const responseData = await response.json();
    switch(responseData.status){
        case 400:
            console.log("Error: Reward already exists but not owned by bot!")
            return;
        default:
            _reward_id[responseData.data[0].id] = reward
            util.updateEnv("REWARD_ID", `'${JSON.stringify(_reward_id)}'`)
    }
}

async function completeReward(broadcaster_id, reward_id, redemption_id){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    var data = {
        "status": "FULFILLED"
    }
    const response = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${broadcaster_id}&reward_id=${reward_id}&id=${redemption_id}`, {
        method: 'PATCH',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID,
            'Content-Type':'application/json'
        },
        body: JSON.stringify(data)
    })
    const responseData = await response.json();
    console.log(responseData)
}

async function fetchSubscriberList(broadcaster_id){
    const accessToken = process.env.TWITCH_OAUTH_TOKEN;
    const response = await fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcaster_id}`, {
        method: 'GET',
        headers:{
            Authorization: `Bearer ${accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID
        }
    })
    const responseData = await response.json();
    if(!responseData.data) return;
    responseData.data.forEach(function (entry, index){
        subscribers[entry.user_name] = parseInt(String(entry.tier).charAt(0));
    })
}

async function pollEnd(event){
    if(!event) return;
    EventHandler.emit('poll', event);
}

async function NotificationMessage(JsonMessage){
    //console.log(JsonMessage);
    const subscription = JsonMessage.payload.subscription;
    const event = JsonMessage.payload.event;
    switch(subscription.type){
        case 'channel.chat.message':
            onMessage(event.broadcaster_user_name, event.chatter_user_name, event.message.text, event.badges)
        break;
        case 'channel.channel_points_custom_reward_redemption.add':
            onChannelPointRedemption(event.broadcaster_user_name, event.broadcaster_user_id, event.user_name, event.reward, event.id, event.user_input)
        break;
        case 'channel.subscribe':
            subscribers[event.user_name] = parseInt(String(entry.tier).charAt(0));
        break;
        case 'channel.subscribe.end':
            delete subscribers[event.user_name];
            break;
        case 'channel.poll.end':
            pollEnd(event);
            break;
        default:
            console.log(subscription.type);
    }
}



async function onMessage(broadcaster, chatter, message, badges =[]){

    if(message.match(regex) == null){
        EventHandler.emit('message', broadcaster, chatter, message, badges)
        return;
    };
    const [raw, command, arg] = message.match(regex);
    if(arg != null){
        EventHandler.emit('command', broadcaster, chatter, command, badges, arg.trim().split(' '));
    }else{
        EventHandler.emit('command', broadcaster, chatter, command, badges);
    }
}

async function onCommand(broadcaster, chatter, command, badges = [], args = null){
    //Emit the Command Event
    if(broadcaster.toLowerCase() == process.env.PRIMARY_BROADCASTER.toLowerCase()){
        //Commands go here
        switch(command.toLowerCase()){
            case 'icon':
                if(!subscribers[chatter]) return;
                if(args == null) {
                    const icons = await util.fetchIcons(subscribers[chatter]);
                    //Send Message
                    sendChatMessage(`Possible Icons: ${icons.join(', ')}`, await fetchUserID(broadcaster))
                    return;
                }else{
                    //Arg provided
                    const temp = await util.tryGetIconFromFile(args[0], subscribers[chatter]);
                    if(!temp.found){
                        const icons = await util.fetchIcons(subscribers[chatter]);
                        sendChatMessage(`Invalid Icon. Possible Icons: ${icons.join(', ')}`, await fetchUserID(broadcaster));
                        return;
                    }
                    //Set Icon to temp.path
                    if(!obs.subscriberItems[chatter]){
                        console.log(`Item not found for ${chatter}`);
                        return;
                    }
                    obs.updateIcon(obs.subscriberItems[chatter].inputUuid, process.cwd() + temp.path.substring(1));
                }
                return;
        }
    }
}

async function onChannelPointRedemption(broadcaster, broadcaster_id, chatter, reward, redemption_id, prompt = ""){
    console.log(reward.title.toLowerCase());
    var redemption
    
    if(_reward_id.hasOwnProperty(reward.id) && _reward_id[reward.id].type){
        redemption = _reward_id[reward.id].type.toLowerCase()
    }else{
        redemption = reward.title.toLowerCase()
        console.log(`Unknown Reward ID: ${reward.id}\nRedemption Name: ${redemption}`)
    }

    switch(redemption.trim()){
        case 'spin':
            spin();
            spin('TestScene', 'Main Scene');
            break;
        case 'tts':
            //Redeem TTS
            util.tts(`${chatter} said ${prompt}`)
            completeReward(broadcaster_id, reward.id, redemption_id)
            break;
        
    }
}

async function TwitchIntegrations(broadcaster, chatter, message, badges = []){
    if(broadcaster.toLowerCase() == process.env.PRIMARY_BROADCASTER.toLowerCase()){
        for(let i = 0; i < badges.length; i++){
            if(badges[i].set_id == "vip" || badges[i].set_id == "moderator"){
                if(message.toLowerCase().includes("tts")){
                    util.tts(message.toLowerCase().replace("tts", ''));
                    return;
                }
            }
        }
        if(message.includes('debug')){
            console.log(`Broadcaster: ${broadcaster}\nChatter: ${chatter}\nMessage: ${message}\nBadges: `);
            console.log(badges);
        }
        if(message.match(regex) == null) return;
        const [raw, command, arg] = message.match(regex);
        if(arg != null){
            onCommand(broadcaster, chatter, command, badges, arg.trim().split(' '));
        }else{
            onCommand(broadcaster, chatter, command, badges);
        }
    }
}

function toggleAllChannelpoints(state){
    for(var reward in _reward_id){
        toggleReward(broadcasterID.trumpet, reward, state)
    }
}

export function Quit(){
    //Disable all channelpoints
    toggleAllChannelpoints(false)
    //Exit Functionality here
    twitch.close(1000);
}

export function register(EventHandler){
    EventHandler.on('message', TwitchIntegrations);
    EventHandler.on('command', onCommand);
    EventHandler.on('quit', Quit);
}
