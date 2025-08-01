import * as dotenv from 'dotenv';
import * as obs from './OBSIntegrations.js'
import * as twitch from './TwitchIntegrations.js'
import * as wss from './WebServer.js'
import * as koth from './KOTH.js'
import * as discord from './DiscordIntegrations.js'
import * as util from './util.js'
import { EventEmitter } from 'node:events';
import * as readline from 'readline'
import * as namegen from './NameGen.js'
import fs from 'node:fs';
import {spawn} from 'child_process'
//import { exit } from 'node:process';
import { stdin as input, stdout as output, stdin } from 'node:process';
dotenv.config();
export var rl = readline.createInterface({input: process.stdin, output: process.stdout})
export const EventHandler = new EventEmitter();
export var RegisterList = [wss.register, twitch.register, obs.register, koth.register, discord.register, namegen.register]
let S2T = null
//Register Listeners
RegisterList.forEach(func => func(EventHandler))

process.title = "TwitchBot";

rl.on('line', (input) => {command(input)})

export function command(input){
    var args = input.split(' ');
    const command = args.shift();
    //Console Command
    switch(command.toLowerCase()){
        // case 'exit':
        // case 'stop':
        // case 'quit':
        //     EventHandler.emit('quit');
        //     console.log('Exitting Application')
        //     rl.close();
        //     break;
        case 'theme':
            if(args.length > 0){
                if(!fs.existsSync(`${process.env.THEME_DIRECTORY}/${args[0]}`)){
                    console.log(`Could not find ${process.env.THEME_DIRECTORY}/${args[0]}`)
                    return;
                }
                obs.SwitchTheme(args[0]);
            }else{
                obs.SwitchTheme('Normal');
            }
            return;
        case 'output':
            util.writeFile();
            return;
        case 'reauth':
            twitch.generateOAuth();
            return;
        case 'poll':
            if(args.length >= 1){
                twitch.createPoll(args[0]);
            }
            return;
        case 'chat':
            if(args.length <= 1){
                return;
            }
            switch(args[0]){
                case 'twitch':
                    let temp = args.splice(1);
                    twitch.sendChatMessage(temp.join(' '));
                return;
                case 'discord':
                console.log('Not Implemented')
                return;
            }
            return;
        case 's2t':
            if(S2T != null){
                console.log("Process already exists")
            }else{
                console.log('Starting SpeechToText')
                S2T = spawn('python3', ['SpeechToText.py'], {
                    cwd: process.cwd(),
                    stdio: "pipe"
                })
                S2T.stdout.on("data", (data) => s2tMessage(data))
                S2T.on("close", ()=>{
                    console.log("[Speech To Text]: Closed Process")
                    S2T = null
                })
            }
        default:
            //console.log(`Unknown Command: \"${command}\"`)
        }
}

function s2tMessage(data){
    if(data == null) return;
    let text = data.toString()
    if(text.length > 6){
        if(text.substring(0,6) == "[data]"){
            let message = text.substring(6)
            //HERE WE GO, THE DATA WITH NO STRINGS ATTATCHED SCREW PYTHON
            return
        }
    }
    console.log(`[Speech To Text]: ${data}`)
}