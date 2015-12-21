/* jshint node:true */
'use strict';

var _path = require('path');
var _fs = require('fs');
var _util = require('util');
var _q = require('q');

var _loggerProvider = require('../logger-provider');
var _startupActions = require('../utils/startup-actions');

var LogHelper = require('../utils/log-helper');
var StartupHelper = require('../utils/startup-helper');
var CommandExecutor = require('../utils/command-executor');
var ConfigBuilder = require('../utils/config-builder');

var logger = _loggerProvider.getLogger('app::startup-processor');
var startupHelper = new StartupHelper(logger);
var logHelper = new LogHelper(logger);
var commandExecutor = new CommandExecutor(logger);
var configBuilder = new ConfigBuilder(logger);

var STARTUP_REQUEST_TIMEOUT = 300 * 1000;

function checkConfigFileExists() {
    var configFile = GLOBAL.config.cfg_config_file;
    logger.debug('Checking if the agent configuration file exists: [%s]', configFile);

    var def = _q.defer();
    _fs.stat(GLOBAL.config.cfg_config_file, function(err, data) {
        if(err) {
           logger.error('Unable to locate configuration file: [%s]', configFile);
           def.reject();
           return;
        }

        logger.info('Configuration file exists: [%s]', configFile);
        def.resolve();
    });

    return def.promise;
}

function checkWatchDirExists(data) {
    var components = _path.parse(GLOBAL.config.cfg_restart_monitor_file);
    logger.debug('Checking if the watch directory exists: [%s]', components.dir);

    var def = _q.defer();
    _fs.stat(components.dir, function(err, stats) {
        if(err) {
            var message = _util.format('Unable to find watch directory: [%s]', components.dir, err);
            logger.error(message);
            def.reject(message);
            return;
        }
        logger.debug('Watch directory exists: [%s]', components.dir);
        def.resolve(data);
    });

    return def.promise;
}

function generateDefaultStartupAction(err) {
    logger.warn('Unable to read gateway config or startup file. Triggering provision mode');
    return {
        action: _startupActions.PROVISION_MODE,
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
            case _startupActions.NO_ACTION:
                logger.info('No action required');
                break;
            case _startupActions.PROVISION_MODE:
                logger.info('Enabling provisioning mode');
                execInfo.skip = true;
                promise = configBuilder.generateGatewayAgentConfig(requestId)
                            .then(configBuilder.generateHostApConfig.bind(configBuilder, requestId))
                            .then(commandExecutor.enableHostAP.bind(commandExecutor, requestId))
                            .then(commandExecutor.enableDhcp.bind(commandExecutor, requestId))
                            .then(startupHelper.writeStartupAction.bind(
                                            startupHelper, _startupActions.NO_ACTION, requestId))
                            .then(commandExecutor.reboot.bind(commandExecutor));
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
 * @module startupProcessor
 */
module.exports = {
    /**
     * Processes the last startup action (obtained from the startup file), and executes
     * additional actions as necessary.
     * 
     * @module startupProcessor
     * @param {Object} execInfo An object that functions as a data bag, allowing
     *          transfer of data across asynchronous calls. This object will typically
     *          contain information that informs processor execution.
     * @return {Object} A promise that will be rejected based on the outcome of the
     *          processing.
     */
    process: function(execInfo) {
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

        return checkConfigFileExists()
            .then(startupHelper.getStartupAction.bind(startupHelper))
            .then(null, generateDefaultStartupAction)
            .then(checkWatchDirExists)
            .then(processStartupAction(execInfo));
    }
};
