'use strict';

const _path = require('path');
const _clone = require('clone');
const Promise = require('bluebird').Promise;
const EventEmitter = require('events').EventEmitter;

const ModuleLoader = require('./module-loader');
const _loggerProvider = require('./logger-provider');

/**
 * A factory class that can be used to instantiate connectors by loading
 * modules from the file system.
 */
class ConnectorFactory {
    /**
     * @param {Object} config A configuration object that defines a mapping
     *          between the connector type and the module
     * @param {String} [basePath='./'] An optional base path that tells the
     *          factory where to load modules from if a relative module path is
     *          specified.
     */
    constructor(config, basePath) {
        this._logger = _loggerProvider.getLogger('connector_factory');
        this._loader = new ModuleLoader('connector_factory', config, basePath);
    }

    /**
     * Creates an instance of a connector of the specified type.
     *
     * @param {String} id A unique id for the connector.
     * @param {String} type The connector type.
     * @param {Object} config The configuration for the connector.
     */
    createConnector(id, type, config) {
        this._logger.info({
            connectorInfo: {
                id: id,
                type: type,
                config: config
            }
        }, 'Creating connector');
        if (typeof id !== 'string' || id.length <= 0) {
            throw new Error('Invalid connector id specified (arg #2)');
        }

        if (typeof type !== 'string' || type.length <= 0) {
            throw new Error('Invalid connector type specified (arg #1)');
        }

        if (!config || (config instanceof Array) || typeof config !== 'object') {
            throw new Error('Invalid connector configuration specified (arg #3)');
        }

        const ConnectorClass = this._loader.getModule(type);
        return new ConnectorClass(id, config);
    }
}

module.exports = ConnectorFactory;
