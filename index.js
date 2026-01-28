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
//Speech 2 Text

S2T = spawn('powershell', //Powershell Command for Speech Recognition
    [
        `add-type -assemblyname system.speech;
        $command = [System.Speech.Recognition.SpeechRecognitionEngine]::new();
        $commands = [System.Speech.Recognition.Choices]::new("tts", "chat twitch");
        $commandGrammar = [System.Speech.Recognition.GrammarBuilder]::new($commands);
        $command.LoadGrammar($commandGrammar);
        $command.SetInputToDefaultAudioDevice();
        
        $sp = [System.Speech.Recognition.SpeechRecognitionEngine]::new();
        $sp.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new());
        $sp.SetInputToDefaultAudioDevice();
        do
        {
            $cmd = $command.Recognize();
            if(-not [System.String]::IsNullOrEmpty($cmd.Text)){
                [console]::beep(3000, 100)
                sleep(0.05)
                [console]::beep(3000, 100)
                $result = $sp.Recognize();
                Write-Host "$($cmd.Text) $($result.Text)" -NoNewline
                [console]::beep(1000, 100)
            }
        } while(1)`
    ],{
        cwd: process.cwd(),
        stdio: "pipe"
    })
    S2T.stdout.on("data", (data) => s2tMessage(data))

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
            util.writeFile(args.join(' '));
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
        /*case 's2t':
            if(S2T != null){
                console.log("Process already exists")
            }else{
                console.log('Starting SpeechToText')
                S2T = spawn('python3', ['python/SpeechToText.py'], {
                    cwd: process.cwd(),
                    stdio: "pipe"
                })
                S2T.stdout.on("data", (data) => s2tMessage(data))
                S2T.on("close", ()=>{
                    console.log("[Speech To Text]: Closed Process")
                    S2T = null
                })
            }
            return;*/
        case 'tts':
            if(args.length > 0){
                util.tts(args.join(' '), undefined, undefined, false)
            }
            return
        default:
            console.log(`Unknown Command: \"${command}\"`)
        }
}

function s2tMessage(data){
    if(data == null) return;
    let text = data.toString()
    text = text.trim();
    command(text)
    console.log(`[Speech To Text]: ${data}`)
}

process.on("SIGINT", async () => {
  EventHandler.emit('quit');
  await util.waitSeconds(1);
  process.exit(0);
});