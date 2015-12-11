#!/usr/bin/env node
/* jshint node:true */
'use strict';

var _args = require('./arg-parser').args;
var _loggerProvider = require('./logger-provider');
var _cncHelper = require('./cnc-helper');
var _package = require('../package.json');

var Controller = require('iot-client-lib').Controller;
var logger = _loggerProvider.getLogger('app');

logger.debug('IOT Gateway, Version: ', _package.version);
logger.debug('Application ready to start. Configuration: ', GLOBAL.config);
function handleCncReadError(error) {
    return {
        action: 'na',
        requestId: 'na',
        message: error,
        timestamp: new Date(0)
    };
}

function logLastCncAction(lastCncAction) {
    logger.info('Last cnc action: [%s]', lastCncAction.action);
    logger.info('Last cnc requestId: [%s]', lastCncAction.requestId);
    if(lastCncAction.message) {
        logger.info('Last cnc message: [%s]', lastCncAction.message);
    }
    if(lastCncAction.timestamp) {
        var date = new Date(lastCncAction.timestamp);
        logger.info('Last cnc timestamp: [%s]', date.toString());
    }
}

function launchController() {
    logger.debug('Creating controller');
    var controller = new Controller({
        moduleBasePath: GLOBAL.config.cfg_module_base_dir
    }, _loggerProvider);

    logger.info('Initializing connectors');
    controller.init(GLOBAL.config.cfg_config_file).then(function() {
        logger.info('Connectors successfully initialized');
    }, function(err) {
        logger.error('Error initializing connectors: ', err);
        logger.warn('Program will continue to execute until explicitly stopped');
    }).done();


    controller.on(Controller.ADMIN_ACTION_EVENT, function(command) {
        logger.info('Received admin action from controller. RequestId: [%s]', command.requestId);
        var promise;
        switch(command.action) {
            case Controller.UPGRADE_ACTION:
                logger.info('Upgrade requested. Will upgrade and terminate. RequestId: [%s]', command.requestId);
                promise = _cncHelper.upgradeProgram(command.requestId)
                            .then(_cncHelper.writeCncAction.bind(command.action, command.requestId));
                break;
            case Controller.SHUTDOWN_ACTION:
                logger.info('Shutdown requested. Will automatically attempt restart. RequestId: [%s]', command.requestId);
                promise = _cncHelper.writeCncAction(command.action, command.requestId);
                break;
            default:
                var def = _q.defer();
                def.resolve();
                promise = def.promise;
                break;
        }

        promise.then(function() {
            logger.info('Terminating. RequestId: [%s]', command.requestId);
        });
    });
};

process.on('exit', function() {
    _cncHelper.touchRestartFile();
});

_cncHelper.readLastCncAction()
    .then(null, handleCncReadError)
    .then(logLastCncAction)
    .then(launchController)
    .done();
