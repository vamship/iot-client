/* jshint node:true */
'use strict';

var _path = require('path');
var _yargs = require('yargs');

var logsDir = _path.resolve(_path.join(__dirname, '../log'));
var connectorsDir = _path.resolve(_path.join(__dirname, './connectors'));
var nodeConfigPath = _path.resolve(_path.join(__dirname, '../config.json'));

var args = _yargs.usage('Usage: $0 [OPTIONS]')
                    .option('node-config', {
                        demand: false,
                        default: nodeConfigPath,
                        type: 'string',
                        describe: 'Path to the node configuration file. ' +
                                    'Node configuration must be specified as JSON, ' +
                                    'and the configuration file be writable by the ' +
                                    'user running the program.\r\n'
                    })
                    .option('log-dir', {
                        demand: false,
                        default: logsDir,
                        type: 'string',
                        describe: 'Path to the directory into which log ' +
                                    'files will be written. This directory must exist, ' +
                                    'and must be writable by the user running the program.\r\n',
                    })
                    .option('no-log-console', {
                        demand: false,
                        default: false,
                        type: 'boolean',
                        describe: 'When specified, does not write any logging statements ' +
                                    'to the console (stderr). It may make sense to use this ' +
                                    'option if the client is being executed as a daemon, ' +
                                    'without captureing stdout/stderr.\r\n'
                    })
                    .option('no-log-file', {
                        demand: false,
                        default: false,
                        type: 'boolean',
                        describe: 'When specified, does not write any logging statements ' +
                                    'to log files. Useful in environments where disk space ' +
                                    'is limited.\r\n'
                    })
                    .option('connector-dir', {
                        demand: false,
                        default: connectorsDir,
                        type: 'string',
                        describe: 'Path to the directory that contains ' +
                                    'custom connector definitions. If not specified, this ' +
                                    'value defaults to the the running directory.\r\n'
                    })
                    .help('help')
                    .alias('help', 'h')
                    .describe('help', 'Show application usage help')
                    .argv;

GLOBAL.config = {};
GLOBAL.config.cfg_no_log_console = args.noLogConsole;
GLOBAL.config.cfg_no_log_file = args.noLogFile;
GLOBAL.config.cfg_node_config_path = args.nodeConfig;
GLOBAL.config.cfg_logs_dir = args.logDir;
GLOBAL.config.cfg_module_base_dir = args.connectorDir;

//NOTE: Logger must be initialized *after* global configuration has been set.
var _loggerProvider = require('./logger-provider');

module.exports = {
    args: args
};
