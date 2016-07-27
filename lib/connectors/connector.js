'use strict';

const _clone = require('clone');
const Promise = require('bluebird').Promise;
const EventEmitter = require('events').EventEmitter;

const _loggerProvider = require('../logger-provider');

/**
 * Base class that represents a connector object that can be used to connect
 * with a device/cloud.
 *
 * @extends {EventEmitter}
 */
class Connector extends EventEmitter {
    /**
     * State that represents a connector that is ready for start up, but has
     * not yet begun the process of starting up. This is the default start
     * state for all connectors.
     *
     * @type {String}
     */
    static get CONNECTOR_STATE_INIT() {
        return 'init';
    }

    /**
     * State that represents a connector that is currently starting up, but is
     * not yet ready.
     *
     * @type {String}
     */
    static get CONNECTOR_STATE_STARTING_UP() {
        return 'starting_up';
    }

    /**
     * State that represents a connector that has started up and is running.
     *
     * @type {String}
     */
    static get CONNECTOR_STATE_STARTED() {
        return 'started';
    }

    /**
     * State that represents a connector that is currently shutting down.
     *
     * @type {String}
     */
    static get CONNECTOR_STATE_SHUTTING_DOWN() {
        return 'shutting_down';
    }

    /**
     * State that represents a connector that has stopped running.
     *
     * @type {String}
     */
    static get CONNECTOR_STATE_STOPPED() {
        return 'stopped';
    }

    /**
     * State that represents a connector that encountered errors during
     * startup, shutdown or execution
     *
     * @type {String}
     */
    static get CONNECTOR_STATE_ERROR() {
        return 'error';
    }

    /**
     * @param {String} id A unique id for the connector.
     * @param {String} type The type of the connector. Should be "cloud" or
     *          "device"
     * @param {Object} config A configuration object for the connector.
     */
    constructor(id, type, config) {
        super();

        if (typeof id !== 'string' || id.length <= 0) {
            throw new Error('Invalid connector id specified (arg #1)');
        }

        if (typeof type !== 'string' || type.length <= 0) {
            throw new Error('Invalid connector type specified (arg #2)');
        }

        if (!config || (config instanceof Array) || typeof config !== 'object') {
            throw new Error('Invalid configuration specified (arg #3)');
        }

        this._id = id;
        this._state = Connector.CONNECTOR_STATE_INIT;
        this._config = _clone(config);

        /**
         * @type {String}
         * @protected
         */
        this._type = type;

        /**
         * @type {Object}
         * @protected
         */
        this._logger = _loggerProvider.getLogger(`con:${this._type}:${this._id}`);
    }

    /**
     * Configures the connector, and is typically called before the connector is
     * started. Child classes may override this method to perform pre start
     * configuration - setting defaults, etc.
     *
     * @protected
     */
    _configure() {}

    /**
     * Starts the connector, and kicks off connector processing. This method
     * must be overridden by child classes to provide connector specific
     * functionality.
     *
     * This method can return any value, including a promise, which will be
     * respected by the calling function.
     *
     * @protected
     * @return {Promise<any, any>|Object} This is an optional return parameter
     *              that can be any value including a promise.
     */
    _start() {
        throw new Error('The _start() method has not been implemented.');
    }

    /**
     * Stops the connector, and cleans up any resources held by the connector.
     * This method must be overridden by child classes to provide connector
     * specific functionality.
     *
     * This method can return any value, including a promise, which will be
     * respected by the calling function.
     *
     * @protected
     * @return {Promise<any, any>|Object} This is an optional return parameter
     *              that can be any value including a promise.
     */
    _stop() {
        throw new Error('The _stop() method has not been implemented.');
    }

    /**
     * The Id of the connector.
     *
     * @type {String}
     */
    get id() {
        return this._id;
    }

    /**
     * Gets the connector type of the connector object. Must be overridden
     * by a child class.
     *
     * @type {String}
     * @readonly
     */
    get type() {
        return this._type;
    }

    /**
     * A string that identifies the current state of the connector.
     *
     * @type {String}
     * @readonly
     */
    get state() {
        return this._state;
    }

    /**
     * The current configuration of the connector.
     *
     * @type {Object}
     */
    get config() {
        return this._config;
    }

    /**
     * Configures and starts the connector. This method should result in the
     * connector performing its tasks, either reading data from devices, or
     * dispatching data into the cloud.
     *
     * @return {Promise<undefined>, Error} A promise that is resolved or
     *              rejected based on the result of the operation.
     */
    start() {
        return new Promise((resolve, reject) => {
            if (this.state !== Connector.CONNECTOR_STATE_INIT) {
                throw new Error(`Connector cannot be started when in [${this.state}] state`);
            }
            return Promise.try(() => {
                this._state = Connector.CONNECTOR_STATE_STARTING_UP;
                this._configure();
                this._logger.info('Connector configuration complete');
                this._logger.info('Starting connector');
                return this._start();
            }).then(() => {
                this._logger.info('Connector started successfully');
                this._state = Connector.CONNECTOR_STATE_STARTED;
                resolve();
            }, (err) => {
                this._logger.error(err, 'Error starting connector');
                this._state = Connector.CONNECTOR_STATE_ERROR;
                reject(err);
            });
        });
    }

    /**
     * Stops the connector. This method should result in the connector shutting
     * down, and becoming inactive.
     *
     * @return {Promise<undefined>, Error} A promise that is resolved or
     *              rejected based on the result of the operation.
     */
    stop() {
        return new Promise((resolve, reject) => {
            if (this.state !== Connector.CONNECTOR_STATE_STARTED) {
                throw new Error(`Connector cannot be stopped when in [${this.state}] state`);
            }
            return Promise.try(() => {
                this._logger.info('Stopping connector');
                this._state = Connector.CONNECTOR_STATE_SHUTTING_DOWN;
                return this._stop();
            }).then(() => {
                this._logger.info('Connector stopped successfully');
                this._state = Connector.CONNECTOR_STATE_STOPPED;
                resolve();
            }, (err) => {
                this._logger.error(err, 'Error stopping connector');
                this._state = Connector.CONNECTOR_STATE_ERROR;
                reject(err);
            });
        });
    }
}

module.exports = Connector;
