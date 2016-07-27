const _path = require('path');
const _yargs = require('yargs');
const _loggerProvider = require('../lib/logger-provider');

const CONFIG_FILE = _path.resolve(_path.join(__dirname, '../config/config.json'));
const MODULE_BASE_PATH = _path.resolve('./');

// Initialize logger
const _logger = _loggerProvider.getLogger('arg_parser');

module.exports = {
    /**
     * Retrieves command line arguments
     * 
     * @returns {Object} A hash containing command line arguments.
     */
    getArgs: function() {
        const args = _yargs.usage('Usage: $0 [OPTIONS]')
                        .option('config-file', {
                            demand: true,
                            default: CONFIG_FILE,
                            type: 'string',
                            describe: 'Path to the configuration file for ' +
                                      'the agent. ' +
                                      '.\r\n'
                            })
                        .option('module-base-path', {
                            demand: false,
                            default: MODULE_BASE_PATH,
                            type: 'string',
                            describe: 'Base path for modules loaded using a ' +
                                      'relative path. ' +
                                      '.\r\n'
                            })
                        .argv;

        const results = {
            configFile: args.configFile,
            moduleBasePath: args.moduleBasePath
        };
        _logger.info('Command line arguments parsed');
        _logger.debug({
            args:results
        }, 'Parsed command line arguments');

        return results;
    }
};
