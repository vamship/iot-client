/* jshint node:true */
'use strict';

var _util = require('util');
var _mqtt = require('mqtt');
var _prompt = require('prompt');
var _mqttHelper = require('./mqtt-helper');

var Commander = require('./cnc-commander');

var username = 'esp';
var password = 'buddon';
var gatewayName = 'gateway1';
var subTopic = _util.format('gateway/%s/%s/+', username, gatewayName);
var pubTopic = _util.format('cloud/%s/%s/', username, gatewayName);

var consoleClient = _mqttHelper.initClient({
    id: 'console',
    endpoint: 'mqtt://127.0.0.1',
    username: username,
    password: password
}, subTopic);

var commander = new Commander({
    id: 'commander',
    endpoint: 'mqtt://127.0.0.1',
    username: username,
    password: password
}, pubTopic);

_prompt.message = '[cnc]';
_prompt.delimiter = '';

function processCommand(results) {
    if(!results || typeof results !== 'object' || 
        typeof results.command !== 'string' || results.command.length <= 0) {
        return false;
    }
    var tokens = results.command.match(/(?:[^\s"]+|"[^"]*")+/g);

    try {
        switch(tokens[0]) {
            case 'quit':
            case 'q':
            case 'exit':
            case 'bye':
                return true;

            //STOP commands
            case 'stop':
                commander.stopConnector(tokens[1], tokens[2]);
                break;
            case 'stc':
                commander.stopConnector('cloud', tokens[1]);
                break;
            case 'std':
                commander.stopConnector('device', tokens[1]);
                break;

            //START commands
            case 'start':
                commander.startConnector(tokens[1], tokens[2]);
                break;
            case 'src':
                commander.startConnector('cloud', tokens[1]);
                break;
            case 'srd':
                commander.startConnector('device', tokens[1]);
                break;

            //RESTART commands
            case 'restart':
                commander.restartConnector(tokens[1], tokens[2]);
                break;
            case 'rsc':
                commander.restartConnector('cloud', tokens[1]);
                break;
            case 'rsd':
                commander.restartConnector('device', tokens[1]);
                break;

            //SHUTDOWN commands
            case 'shutdown':
            case 'shd':
                commander.shutdownGateway();
                break;

            //UPGRADE commands
            case 'upgrade':
            case 'upg':
                commander.upgradeGateway();
                break;
            default:
                console.log('bad command'.red);
                break;
        }
    } catch (ex) {
        console.log(ex.toString().red);
    }

    return false;
}
function showPrompt() {
    _prompt.get([ {
        name: 'command',
        description: ' '
    } ], function(err, results) {
        if(err) {
            console.log(_util.format('Error:', err).red);
        } else if(processCommand(results)) {
            console.log('goodbye'.green);
            process.exit(0);
        } else {
            process.nextTick(showPrompt);
        }
    });
}
_prompt.start();
showPrompt();
