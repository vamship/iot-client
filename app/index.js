/* jshint node:true */
'use strict';

var _iotLib = require('iot-client-lib');

var controller = new _iotLib.Controller({
    moduleBasePath: __dirname
});

controller.init('./config.json').then(function() {
    console.log('Configuration successfully loaded');
}, function(err) {
    console.log('Error loading configuration: ', err);
});


setTimeout(function() {
    console.log('Stopping');
    controller.stop();
}, 30000);
