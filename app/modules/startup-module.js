/* jshint node:true */
'use strict';

var _path = require('path');
var _fs = require('fs');
var _util = require('util');
var _q = require('q');

var _loggerProvider = require('../logger-provider');

var LogHelper = require('../utils/log-helper');
var StartupHelper = require('../utils/startup-helper');
var CommandExecutor = require('../utils/command-executor');
var ConfigBuilder = require('../utils/config-builder');

var logger = _loggerProvider.getLogger('app::startup-module');
var startupHelper = new StartupHelper(logger);
var logHelper = new LogHelper(logger);
var commandExecutor = new CommandExecutor(logger);
var configBuilder = new ConfigBuilder(logger);

var STARTUP_REQUEST_TIMEOUT = 300 * 1000;

function checkConfigFileExists(startupAction) {
    var configFile = GLOBAL.config.cfg_config_file;
    logger.debug('Checking if the agent configuration file exists: [%s]', configFile);

    var def = _q.defer();

    if(startupAction && typeof startupAction === 'object' &&
       startupAction.action === StartupHelper.MOCK_STARTUP) {
        logger.warn('Received mock startup action. No check for config file will be performed');
        def.resolve(startupAction);
        return def.promise;
    }

    _fs.stat(GLOBAL.config.cfg_config_file, function(err, data) {
        if(err) {
           logger.error('Unable to locate configuration file: [%s]', configFile);
           def.reject(startupAction);
           return;
        }

        logger.info('Configuration file exists: [%s]', configFile);
        def.resolve(startupAction);
    });

    return def.promise;
}

function checkWatchDirExists(startupAction) {
    var components = _path.parse(GLOBAL.config.cfg_restart_monitor_file);
    logger.debug('Checking if the watch directory exists: [%s]', components.dir);

    var def = _q.defer();

    if(startupAction && typeof startupAction === 'object' &&
       startupAction.action === StartupHelper.MOCK_STARTUP) {
        logger.warn('Received mock startup action. No check for watch directory will be performed');
        def.resolve(startupAction);
        return def.promise;
    }

    _fs.stat(components.dir, function(err, stats) {
        if(err) {
            var message = _util.format('Unable to find watch directory: [%s]', components.dir, err);
            logger.error(message);
            def.reject(message);
            return;
        }
        logger.debug('Watch directory exists: [%s]', components.dir);
        def.resolve(startupAction);
    });

    return def.promise;
}

function generateDefaultStartupAction(err) {
    logger.warn('Unable to read gateway config or startup file. Triggering provision mode');
    
    return {
        action: StartupHelper.PROVISION_MODE,
        requestId: 'startup',
        message: 'Unable to read last recorded startup action',
        timestamp: Date.now()
    };
}

function processStartupAction(execInfo) {
    return function(startupAction) {
        execInfo.startupAction = startupAction;
        var requestId = startupAction.requestId;
        var promise = null;
        logger.info('Processing startup action: [%s]', startupAction.action);
        switch(startupAction.action) {
            case StartupHelper.NO_ACTION:
                logger.info('Normal startup. No startup actions required');
                break;
            case StartupHelper.PROVISION_MODE:
                logger.warn('Enabling provisioning mode');
                execInfo.skip = true;
                promise = configBuilder.generateGatewayAgentConfig(requestId)
                            .then(configBuilder.generateHostApConfig.bind(configBuilder, requestId))
                            .then(commandExecutor.enableHostAP.bind(commandExecutor, requestId))
                            .then(commandExecutor.enableDhcp.bind(commandExecutor, requestId))
                            .then(commandExecutor.reboot.bind(commandExecutor, requestId))
                            .then(startupHelper.setStartupAction.bind(
                                            startupHelper, StartupHelper.NO_ACTION, requestId));
                break;
            case StartupHelper.MOCK_STARTUP:
                logger.warn('Mock startup mode. No startup actions required');
                execInfo.skip = true;
                break;
            default:
                logger.info('No action taken for startup action: [%s]', startupAction.action);
                break;
        }

        if(promise) {
            return promise.then(function() {
                return execInfo;
            });
        } else {
            return execInfo;
        }
    };
}

/**
 * Processor module that is responsible for reading previous startup actions
 * (as written to the startup file), and taking necessary actions.
 *
 * @module modules.startup
 */
module.exports = {
    /**
     * Processes the last startup action (obtained from the startup file), and executes
     * additional actions as necessary.
     * 
     * @module modules.startup
     * @method start
     * @param {Object} execInfo An object that functions as a data bag, allowing
     *          transfer of data across asynchronous calls. This object will typically
     *          contain information that informs module execution.
     * @return {Object} A promise that will be rejected based on the outcome of the
     *          processing.
     */
    start: function(execInfo) {
        if(!execInfo || typeof execInfo !== 'object') {
            logger.error('Invalid execution info specified (arg #1)');
            throw new Error('Invalid execution info specified (arg #1)');
        }
        var skip = !!(execInfo.skip);

        logger.info('Processing:', execInfo);

        var def = _q.defer();
        if(skip) {
            logger.info('Skipping processing');
            def.resolve('Skipping processing');
            return def.promise;
        }

        return startupHelper.getStartupAction()
            .then(checkConfigFileExists)
            .then(null, generateDefaultStartupAction)
            .then(checkWatchDirExists)
            .then(processStartupAction(execInfo));
    },

    /**
     * Attempts a graceful shutdown of the module.
     *
     * @module modules.startup
     * @method stop
     * @param {String} [requestId] An optional request id to use for logging
     * @return {Object} A promise that will be rejected based on the outcome of the
     *          shutdown.
     */
    stop: function(requestId) {
        requestId = requestId || 'na';
        var def = _q.defer();
        logger.info('Attempting graceful shutdown. RequestId: [%s]', requestId);
        def.resolve();
        logger.info('Module shutdown complete. RequestId: [%s]', requestId);
        return def.promise;
    }
};
