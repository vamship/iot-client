'use strict';

const _path = require('path');
const _clone = require('clone');
const Promise = require('bluebird').Promise;
const EventEmitter = require('events').EventEmitter;

const _loggerProvider = require('./logger-provider');

/**
 * A loader class that can be used to load modules from the file system
 */
class ModuleLoader {
    /**
     * @param {String} name The name of the factory (used primarily for
     *          logging).
     * @param {Object} config A configuration object that defines a mapping
     *          between the connector type and the module
     * @param {String} [basePath='./'] An optional base path that tells the
     *          loader where to load modules from if a relative module path is
     *          specified.
     */
    constructor(name, config, basePath) {
        if (typeof name !== 'string' || name.length <= 0) {
            throw new Error('Invalid factory name specified (arg #1)');
        }
        if (!config || (config instanceof Array) || typeof config !== 'object') {
            throw new Error('Invalid type configuration specified (arg #1)');
        }
        if (typeof basePath !== 'string' || basePath.length <= 0) {
            basePath = './';
        }

        this._logger = _loggerProvider.getLogger(`${name}:module_loader`);
        this._basePath = basePath;
        this._typeMap = {};
        this._initTypes(config);
    }

    /**
     * Initializes module references from the file system.
     *
     * @private
     * @param {Object} config The type map configuration.
     */
    _initTypes(config) {
        this._logger.debug({
            typeConfig: config,
            basePath: this.basePath
        }, 'Module type config');
        this._logger.info('Initializing modules from config');
        for (var type in config) {

            var modulePath = config[type];
            if (typeof modulePath !== 'string' || modulePath.length <= 0) {
                throw new Error(`Invalid module path specified for [${type}]`);
            }
            if (modulePath.startsWith('./')) {
                this._logger.debug({
                    modulePath: modulePath,
                    basePath: this.basePath
                }, 'Resolving module path with base path');
                modulePath = _path.resolve(this.basePath, modulePath);
            }
            this._logger.info(`Initializing module [${type}]::[${modulePath}]`);
            this._typeMap[type] = require(modulePath);
        }
    }

    /**
     * The base path to use when loading modules identified with relative paths.
     *
     * @type {String}
     */
    get basePath() {
        return this._basePath;
    }


    /**
     * Returns a module reference based on the specified type string.
     * 
     * @param {String} type The module type string.
     */
    getModule(type) {
        if (typeof type !== 'string' || type.length <= 0) {
            throw new Error('Invalid module type specified (arg #1)');
        }
        this._logger.info(`Looking up module for type: [${type}]]`);
        const module = this._typeMap[type];
        if (!module) {
            throw new Error(`Specified type does not map to a valid module: [${type}]`);
        }
        return module;
    }
}

module.exports = ModuleLoader;
