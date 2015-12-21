'use strict';
/* jshint node:true */

var _q = require('q');

var _loggerProvider = require('../logger-provider');
var StartupHelper = require('../utils/startup-helper');
var CommandExecutor = require('../utils/command-executor');

var Controller = require('iot-client-lib').Controller;

var logger = _loggerProvider.getLogger('app::controller-launcher');
var startupHelper = new StartupHelper(logger);
var commandExecutor = new CommandExecutor(logger);

var _controller = null;

/**
 * Processor module that is responsible for configuring and launching the
 * controller.
 *
 * @module controllerLauncher
 */
module.exports = {
    /**
     * Configures and launches the controller.
     * 
     * @module controllerLauncher
     * @param {Object} execInfo An object that defines how the module executes its
     *          processing logic.
     * @return {Object} A promise that will be rejected based on the outcome of the
     *          processing.
     */
    process: function(execInfo) {
        if(!execInfo || typeof execInfo !== 'object') {
            logger.error('Invalid execution info specified (arg #1)');
            throw new Error('Invalid execution info specified (arg #1)');
        }
        if(!execInfo.startupAction || typeof execInfo.startupAction !== 'object') {
            logger.error('Execution info does not define a valid startup action (execInfo.startupAction)');
            throw new Error('Execution info does not define a valid startup action (execInfo.startupAction)');
        }

        var startupAction = execInfo.startupAction;
        var skip = !!(execInfo.skip);

        logger.info('Processing:', execInfo);

        var def = _q.defer();
        if(skip) {
            logger.info('Skipping processing');
            def.resolve('Skipping processing');
            return def.promise;
        }

        logger.debug('Creating controller');
        _controller = new Controller({
            moduleBasePath: GLOBAL.config.cfg_module_base_dir
        }, _loggerProvider);


        logger.debug('Attaching admin action event handlers');
        _controller.on(Controller.ADMIN_ACTION_EVENT, function(command) {
            logger.info('Received admin action from controller. RequestId: [%s]', command.requestId);
            var promise;
            switch(command.action) {
                case Controller.UPGRADE_ACTION:
                    logger.info('Upgrade requested. Will upgrade and terminate. RequestId: [%s]', command.requestId);
                    promise = commandExecutor.upgradeProgram(command.requestId)
                                .then(startupHelper.touchRestartMonitor.bind(startupHelper));
                    break;
                case Controller.SHUTDOWN_ACTION:
                    logger.info('Shutdown requested. Will automatically attempt restart. RequestId: [%s]', command.requestId);
                    promise = startupHelper.touchRestartMonitor();
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

        logger.info('Initializing connectors');
        _controller.init(GLOBAL.config.cfg_config_file, startupAction.requestId).then(function() {
            logger.info('Connectors successfully initialized');
            def.resolve(startupAction);
        }, function(err) {
            logger.error('One or more connectors failed to initialize: [%s]', err);
            def.reject(err);
        });

        return def.promise;
    },

    /**
     * Attempts a graceful shutdown of a previously initialized controller.
     *
     * @module controllerLauncher
     * @return {Object} A promise that will be rejected based on the outcome of the
     *          shutdown.
     */
    shutdown: function() {
        var def = _q.defer();
        if(_controller) {
            logger.info('Attempting graceful controller shutdown.');
            _controller.stop('ext_SIGINT').fin(function() {
                logger.info('Controller shutdown complete.');
                def.resolve();
            });
        } else {
            logger.info('Controller not initialized. Nothing to shut down');
            def.resolve();
        }

        return def.promise;
    }
};
