#!/usr/bin/env node
/* jshint node:true */
'use strict';

var _package = require('../package.json');
var _args = require('./arg-parser').args;
var _loggerProvider = require('./logger-provider');

var _startupModule = require('./modules/startup-module');
var _controllerModule = require('./modules/agent-module');

var LogHelper = require('./utils/log-helper');
var logger = _loggerProvider.getLogger('app');
var logHelper = new LogHelper(logger);

process.on('SIGINT', function(){
    logger.info('SIGINT received. Shutting down modules');
    _controllerModule.stop()
        .fin(_startupModule.stop.bind(_startupModule))
        .fin(function() {
            logger.info('Terminating agent');
            process.exit(0);
        });
});

logger.info('IOT Gateway. Version: ', _package.version);
logHelper.logObject(GLOBAL.config, 'info', true);

_startupModule.start({ skip: false })
    .then(_controllerModule.start.bind(_controllerModule))
    .done();
