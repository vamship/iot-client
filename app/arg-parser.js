/* jshint node:true */
'use strict';

var _path = require('path');
var _yargs = require('yargs');

var configDir = _path.resolve(_path.join(__dirname, '../config'));
var logsDir = _path.resolve(_path.join(__dirname, '../log'));

var connectorsDir = _path.resolve(_path.join(__dirname, './connectors'));

var baselineConfigFilePath = _path.resolve(_path.join(__dirname, '../config/config.json'));
var outboudNetworkInterface = 'eth0';
var localNetworkInterface = 'wlan0';
var localNetworkGateway = '10.0.0.1';

var args = _yargs.usage('Usage: $0 [OPTIONS]')
                    .option('config-dir', {
                        demand: false,
                        default: configDir,
                        type: 'string',
                        describe: 'Path to the configuration directory for the gateway. ' +
                                    'This directory must contain the watch/ sub ' +
                                    'directory, and any configuration files required ' +
                                    'by the agent. Files in these directories must ' +
                                    'be writable by the agent program' +
                                    '.\r\n'
                    })
                    .option('log-dir', {
                        demand: false,
                        default: logsDir,
                        type: 'string',
                        describe: 'Path to the directory into which log ' +
                                    'files will be written. This directory must exist, ' +
                                    'and must be writable by the user running the program.\r\n',
                    })
                    .option('connector-dir', {
                        demand: false,
                        default: connectorsDir,
                        type: 'string',
                        describe: 'Path to the directory that contains ' +
                                    'custom connector definitions. If not specified, this ' +
                                    'value defaults to the the running directory.\r\n'
                    })
                    .option('baseline-config-file', {
                        demand: false,
                        default: baselineConfigFilePath,
                        type: 'string',
                        describe: 'Path to the baseline configuration file provided ' +
                                    'with this program. This value should typically ' +
                                    'remain unspecified, except in special circumstances.' +
                                    '\r\n'
                    })
                    .option('outbound-network-interface', {
                        demand: false,
                        default: outboudNetworkInterface,
                        type: 'string',
                        describe: 'The outbound network interface for the gateway. ' +
                                    'This should be the interface that allows access ' +
                                    'to the internet.' +
                                    '\r\n'
                    })
                    .option('local-network-interface', {
                        demand: false,
                        default: localNetworkInterface,
                        type: 'string',
                        describe: 'The local network interface for the gateway. ' +
                                    'This should be the interface hosts local access ' +
                                    'points, typically with no access to the internet.' +
                                    '\r\n'
                    })
                    .option('local-network-gateway', {
                        demand: false,
                        default: localNetworkGateway,
                        type: 'string',
                        describe: 'The gateway ip address of the local wifi network that ' +
                                    'will be created during the provisioning process. ' +
                                    '\r\n'
                    })
                    .option('log-level', {
                        demand: false,
                        default: 'info',
                        type: 'string',
                        describe: 'Specifies the log level of the logger. \r\n  '
                    })
                    .option('no-log-console', {
                        demand: false,
                        default: false,
                        type: 'boolean',
                        describe: 'When specified, does not write any logging statements ' +
                                    'to the console (stderr). It may make sense to use this ' +
                                    'option if the client is being executed as a daemon, ' +
                                    'without capturing stdout/stderr.\r\n'
                    })
                    .option('no-log-file', {
                        demand: false,
                        default: false,
                        type: 'boolean',
                        describe: 'When specified, does not write any logging statements ' +
                                    'to log files. Useful in environments where disk space ' +
                                    'is limited.\r\n'
                    })
                    .help('help')
                    .alias('help', 'h')
                    .describe('help', 'Show application usage help')
                    .argv;

GLOBAL.config = {};
GLOBAL.config.cfg_program_root = __dirname;
GLOBAL.config.cfg_config_dir = args.configDir;
GLOBAL.config.cfg_config_file = _path.resolve(_path.join(args.configDir, 'config.json'));
GLOBAL.config.cfg_startup_file = _path.resolve(_path.join(args.configDir, 'startup.json'));

GLOBAL.config.cfg_restart_monitor_file = _path.resolve(_path.join(args.configDir, 'watch/monitor'));
GLOBAL.config.cfg_logs_dir = args.logDir;

GLOBAL.config.cfg_module_base_dir = args.connectorDir;

GLOBAL.config.cfg_log_level = args.logLevel;
GLOBAL.config.cfg_no_log_file = args.noLogFile;
GLOBAL.config.cfg_no_log_console = args.noLogConsole;

GLOBAL.config.cfg_baseline_config_file = args.baselineConfigFile;
GLOBAL.config.cfg_outbound_network_interface = args.outboundNetworkInterface;
GLOBAL.config.cfg_local_network_interface = args.localNetworkInterface;
GLOBAL.config.cfg_local_network_gateway = args.localNetworkGateway;

//NOTE: Logger must be initialized *after* global configuration has been set.
var _loggerProvider = require('./logger-provider');

module.exports = {
    args: args
};
