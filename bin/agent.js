#!/usr/bin/env node

// Configure logger provider and logger.
const _loggerProvider = require('../lib/logger-provider');
_loggerProvider.configure({
    appName: 'iot_agent',
    logLevel: 'debug'
});
const logger = _loggerProvider.getLogger('app');


// Require other dependencies.
const ConnectorFactory = require('../lib/connector-factory');
const Hub = require('../lib/hub');
const CommandHandler = require('../lib/command-handler');
const AgentConfigFile = require('../lib/config/agent-config-file');
const _argParser = require('./arg-parser');


/**
 * Starts the agent using the specified agent configuration.
 * 
 * @param {Object} agentConfig An object containing agent configuration.
 */
function startAgent(agentConfig) {
    const config = agentConfig.data;
    logger.info('Initializing connector factory');
    logger.debug({ factoryConfig: config }, 'Factory parameters');
    const factory = new ConnectorFactory(config.connectorTypes);

    logger.info('Initializing connector hub');
    const hub = new Hub(factory);

    logger.info('Initializing Command handler');
    const handler = new CommandHandler(hub);

    // Start up the CnC connector
    hub.startCnc(config.cnc).then(() => {
        logger.info('Agent started successfully');
    }, (err) => {
        logger.fatal(err, 'Error starting agent');
    });
}

// Initialize app logger.
const args = _argParser.getArgs();

const agentConfig = new AgentConfigFile(args.configFile);
agentConfig.load().then(() => {
   startAgent(agentConfig);
});
