import fs from 'node:fs';
import os from 'node:os';
import say from 'say';

const voices = await getVoices();
const defaultVoice = voices[5];
const defaultPitch = 1;

export async function writeFile(lines = [''], file = 'Output.txt'){
    fs.writeFile(file, lines.join('\n'), () => {});
}

export async function updateFile(lines = [''], file = 'Output.txt'){
    if(!fs.existsSync(file)){
        writeFile(lines, file);
        return;
    }
    console.log(lines);
    let text = fs.readFileSync(file).toString();
    //Check duplicates
    text.split('\n').forEach(line => {
        let temp = checkDuplicates(line, lines);
        if(temp){
            //Remove duplicates from prexisting lines
            lines.splice(temp);
        }
    })
    //Insert text at beginning
    let finalLines = text.split('\n').concat(lines);
    fs.unlinkSync(file);
    writeFile(finalLines, file);
}

function checkDuplicates(Item, list = []){
    list.forEach(value => {
        if(value.toLowerCase() == Item.toLowerCase()){
            return list.indexOf(value);
        }
    })
}

export async function removeFromFile(lines = [''], file = 'Output.txt'){
    if(!fs.existsSync(file)){
        return;
    }
    let text = await fs.readFileSync(file).toString();
    let start = text.split('\n');
    lines.forEach(line => {
        temp = checkDuplicates(line, start);
        if(temp){
            //Remove duplicate
            start.splice(temp);
        }
    });
    fs.unlinkSync(file);
    writeFile(start.join('\n'), file);
}

export function waitSeconds(x) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, x * 1000); // Convert seconds to milliseconds
    });
}

export function updateEnv(key, value){
    const ENV_VARS = fs.readFileSync("./.env", "utf8").split(os.EOL);
    const target = ENV_VARS.indexOf(ENV_VARS.find((line) => {
        return line.match(new RegExp(key));
    }));
    // replace the key/value with the new value
    ENV_VARS.splice(target, 1, `${key}=${value}`);
    // write everything back to the file system
    fs.writeFileSync(process.cwd() + "/.env", ENV_VARS.join(os.EOL));
}

/**
 * 
 * @param {Number} subTier 
 * @returns {String[]}
 */
export async function fetchIcons(subTier) {
    var list = [];
    switch(subTier){
        case 0: return;
        case 3: 
        var out = await new Promise(
            function(resolve, reject){
            fs.readdir('./emotes/tier3/', function callback(err, out){
                resolve(out);
        })});
        list = list.concat(out);
        case 2:
        var out = await new Promise(
            function(resolve, reject){
            fs.readdir('./emotes/tier2/', function callback(err, out){
                resolve(out);
        })});
        list = list.concat(out);
        case 1:
        var out = await new Promise(
            function(resolve, reject){
            fs.readdir('./emotes/tier1/', function callback(err, out){
                resolve(out);
        })});
        list = list.concat(out);
    }
    return list;
}
/**
 * 
 * @param {String} iconName 
 * @param {Number} subTier 
 * @returns {{found:Boolean, path:String}}bool FoundIcon, Path found
 */
export async function tryGetIconFromFile(iconName, subTier = -1){
    var found;
     switch(subTier){
        case -1:
        case 3:
            var out = await new Promise(
            function(resolve, reject){
            fs.readdir('./emotes/tier3', function callback(err, out){
                resolve(out);
            })});
            found = out.find((element) => element.toLowerCase().includes(iconName.toLowerCase()));
            if(found){
                return {found:true, path:`./emotes/tier3/${found}`};
            }
        case 2:
            var out = await new Promise(
            function(resolve, reject){
            fs.readdir('./emotes/tier2', function callback(err, out){
                resolve(out);
            })});
            found = out.find((element) => element.toLowerCase().includes(iconName.toLowerCase()));
            if(found){
                return {found:true, path:`./emotes/tier2/${found}`};
            }
        case 1:
            var out = await new Promise(
            function(resolve, reject){
            fs.readdir('./emotes/tier1', function callback(err, out){
                resolve(out);
            })});
            found = out.find((element) => element.toLowerCase().includes(iconName.toLowerCase()));
            if(found){
                return {found:true, path:`./emotes/tier1/${found}`};
            }
     }
     return {found:false, path:null};
}

export function getVoices() {
    return new Promise((resolve) => {
      say.getInstalledVoices((err, voices) => {
        return resolve(voices)
      })
    })
}

export function tts(text, voice = defaultVoice, pitch = defaultPitch){
    say.speak(text, voice, pitch)
}