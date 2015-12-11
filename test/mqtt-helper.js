/* jshint node:true */
'use strict';

var _util = require('util');
var _mqtt = require('mqtt');
var _colors = require('colors');

module.exports = {
    initClient: function(connectOptions, topic) {
        if(!connectOptions || typeof connectOptions !== 'object') {
            throw new Error('Invalid connect options specified (arg #1)');
        }

        topic = topic;
        var client = _mqtt.connect(connectOptions.endpoint, {
            clientId: connectOptions.id,
            username: connectOptions.username,
            password: connectOptions.password,
            clean: true
        });

        client.on('error', function(err) {
            console.log(_util.format('Error on client: [%s]', connectOptions.id, err).red);
        });

        if(topic) {
            client.on('message', function(topic, message) {
                try{
                    message = message.toString();
                    if(message.toLowerCase().indexOf('error') >= 0) {
                        message = message.red;
                    } else {
                        message = message.white;
                    }
                    console.log(message);
                } catch(ex) {
                    console.log(_util.format('Unable to parse message from broker', ex).red);
                }
            });
        }

        client.on('connect', function() {
            console.log(_util.format('MQTT client connected: [%s]', connectOptions.id).white);
            if(topic) {
                client.subscribe(topic, {qos:2});
            }
        });

        return client;
    }
}
