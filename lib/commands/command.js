'use strict';

const _os = require('os');
const _loggerProvider = require('../logger-provider');
const _clone = require('clone');
const Promise = require('bluebird').Promise;

// This needs to be non const to allow testing via rewire
let _childProcess = require('child_process');

/**
 * Base class that represents an abstracted command that can be executed on the
 * host operating system. Supports multiple underlying implementations based on
 * the host operating system type.
 */
class Command {
    /**
     * @param {String} name A name (alias) for the command. Mostly used for
     *          logging.
     * @param {Object} config A configuration object that describes the
     *          implementation details for the command under different
     *          operating systems.
     */
    constructor(name, config) {
        if (typeof name !== 'string' || name.length <= 0) {
            throw new Error('Invalid command name specified (arg #1)');
        }

        if (!config || (config instanceof Array) || typeof config !== 'object') {
            throw new Error('Invalid command configuration specified (arg #2)');
        }

        this._name = name;
        this._platform = _os.platform();
        this._config = _clone(config);
        this._logger = _loggerProvider.getLogger(`command:${this._name}`);
    }

    /**
     * Returns the command name (alias).
     *
     * @type {String}
     */
    get name() {
        return this._name;
    }

    /**
     * Returns the current host platform string
     *
     * @type {String}
     */
    get platform() {
        return this._platform;
    }

    /**
     * Executes the command represented by this object for the current platform.
     *
     * @return {Promise<undefined, Error>} A promise that is rejected/resolved
     *          based on the outcome of the command execution.
     */
    run() {
        return Promise.try(() => {
            const config = this._config[this._platform];
            if (!config || (config instanceof Array) || typeof config !== 'object') {
                throw new Error(`Command [${this.name}] does not define a valid configuration for the platform [${this.platform}]`);
            }
            if (typeof config.command !== 'string' || config.command.length <= 0) {
                throw new Error(`Command configuration [${this.name}] does not define a valid command [${config.command}]`);
            }
            if (!(config.args instanceof Array)) {
                throw new Error(`Command configuration [${this.name}] does not define valid arguments [${config.args}]`);
            }

            this._logger.info(`Executing command: [${config.command}] [${config.args}]`);
            return new Promise((resolve, reject) => {
                const command = config.command;
                const args = config.args;

                this._logger.debug(`Starting command [${this.name}]: [${command}][${args}]`);
                var proc = _childProcess.spawn(command, args);

                // Log output of STDOUT and STDERR
                this._logger.debug(`Enabling output/error logs for command: [${command}][${args}]`);

                proc.stdout.on('data', (data) => {
                    this._logger.info(`[STDOUT] [${data.toString()}]`, data.toString());
                });

                proc.stderr.on('data', (data) => {
                    this._logger.info(`[STDERR] [${data.toString()}]`);
                });

                proc.on('error', (error) => {
                    this._logger.error(error, `Error executing command: [${command}] [${args}]`);
                    reject(error);
                });

                proc.on('close', (code) => {
                    if (!code) {
                        this._logger.info(`Command completed successfully [${this.name}]: [${command}] [${args}]`);
                        resolve();
                        return;
                    }
                    const error = new Error(`Command exited with non zero code [${this.name}]: [${command}] [${args}]. Code: [${code}]`);
                    this._logger.error(error, `Error executing command [${this.name}]: [${command}] [${args}]`);
                    reject(error);
                });
            });
        });
    }
}

module.exports = Command;
