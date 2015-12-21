#!/usr/bin/env node
/* jshint node:true */
'use strict';

var _package = require('../package.json');
var _args = require('./arg-parser').args;
var _loggerProvider = require('./logger-provider');

var _startupProcessor = require('./processors/startup-processor');
var _controllerLauncher = require('./processors/controller-launcher');

var _startupActions = require('./utils/startup-actions');
var StartupHelper = require('./utils/startup-helper')
var LogHelper = require('./utils/log-helper');


var logger = _loggerProvider.getLogger('app');
var startupHelper = new StartupHelper(logger);
var logHelper = new LogHelper(logger);

process.on('exit', function() {
    //startupHelper.touchRestartFile();
});

process.on('SIGINT', function(){
    logger.info('SIGINT received. Shutting down controller');
    _controllerLauncher.shutdown().fin(function() {
        logger.info('Terminating agent');
        process.exit(0);
    });
});

logger.info('IOT Gateway. Version: ', _package.version);
logHelper.logObject(GLOBAL.config, 'info', true);

_startupProcessor.process({ skip: false })
    .then(_controllerLauncher.process.bind(_controllerLauncher))
    .done();
