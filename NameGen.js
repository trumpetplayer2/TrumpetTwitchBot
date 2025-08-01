import * as Twitch from './TwitchIntegrations.js'
import * as util from './util.js'
//This will add names to a file that win a poll
let handles = [];

async function onPollEnd(event){
    if(event.status.toLowerCase() != 'completed') return;
    if(!handles.includes(event.id)) return;
    let name = event.title.substring(7, event.title.length - 27);
    //Managed Poll Completed
    if(event.choices[0].votes > event.choices[1].votes){
        //The Name Won!
        console.log(`Added ${name} to name list`)
        Twitch.sendChatMessage(`Added ${name} to the list.`)
        util.updateFile([name], 'NameList.data')
    }else{
        //The Name Lost
        console.log(`${name} did not receive enough votes to be added.`);
        Twitch.sendChatMessage(`${name} did not receive enough votes to be added.`)
    }
    handles.splice(handles.indexOf(event.id));
}

async function onCommand(broadcaster, chatter, command, badges = [], args = null){
    if(command.toLowerCase() != 'addname') return;
    if(!args) return;
    const choices = [{'title': 'Yes'}, {'title': 'No'}]
    Twitch.createPoll(`Should ${args.join(' ')} be added to the name list?`, choices, 15).then(temp => {
        if(!temp) return;
        handles.push(temp);
    })
    
}

export function register(EventHandler){
    EventHandler.on('command', onCommand)
    EventHandler.on('poll', onPollEnd)
}