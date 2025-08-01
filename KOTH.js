import { getObsConnected as connected, changeText } from "./OBSIntegrations.js";
import { fetchUserID, addVIP, removeVIP, vips, sendChatMessage, timeoutUser, mods} from "./TwitchIntegrations.js";
import { updateEnv } from "./util.js";
import { randomInt } from "node:crypto";
import * as dotenv from 'dotenv';

dotenv.config();

export var King = process.env.KING;

const keywords = ['dethrone', 'king', 'queen', 'attack', 'rise', 'koth', 'hill', 'conquer'];

async function messageHandler(broadcaster, chatter, command, badges, message){
    if(broadcaster.toLowerCase() != process.env.PRIMARY_BROADCASTER.toLowerCase()) return;
    //If OBS not connected, return
    if(await !connected()) return;
    //VIPS cannot be KOTH
    if(vips[chatter]) return;
    if(mods[chatter]) return;
    if(broadcaster == chatter) return;
    //Message recieved
    if(fetchUserID(chatter) == process.env.KING) return;
    keywords.some(word => {
        if(command.toLowerCase().includes(word.toLowerCase())){
            //Keyword contained
            attemptDethrone(chatter, message);
            return true;
        }
    });
}

async function attemptDethrone(chatter, message){
    //If no King found, claim throne
    if(King.trim() == ""){
        sendChatMessage(`${chatter} has claimed the throne!`)
        addVIP(chatter);
        King = chatter;
        updateEnv('KING', chatter);
        changeText('Throne', `Current Throne Holder: \n${King}`);
        return;
    }
    //King exists, roll d20 to see if you take throne
    if(randomInt(20) == 1){
        //Dethroned!
        if(await addVIP(chatter)){
            var oldKingId = await fetchUserID(King)
            //VIP Added, remove old one
            removeVIP(King);
            timeoutUser(oldKingId, 3, "You have been Dethroned!")
            sendChatMessage(`${chatter} has dethroned ${King} via ${message}`);
            King = chatter;
            updateEnv('KING', chatter);
            changeText('Throne', `Current Throne Holder: \n${King}`)
        }

    }else{
        sendChatMessage(`${chatter} failed to dethrone ${King} via ${message}`);
        if(process.env.KOTH_BANS === 'true' || process.env.KOTH_BANS === 1){
            timeoutUser(await fetchUserID(chatter), 3, "Failed to Dethrone King!");
        }
    }
}

export function Quit(){
    //Exit Functionality Here
}

export function register(EventHandler){
    EventHandler.on('command', messageHandler);
    EventHandler.on('quit', Quit);
}