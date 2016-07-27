'use strict';

const _loggerProvider = require('./logger-provider');
const CloudConnector = require('./connectors/cloud-connector');

/**
 * Class that represents a CnC request from the cloud. Provides methods that
 * can be used to log progress and status against the request, in addition to
 * methods that respond to the request.
 */
class CncRequest {
    /**
     * @param {Object} command The command received from the cloud that
     *          describes the action to be taken.
     * @param {Object} connector A reference to the CnC connector that will
     *          dispatch messages and responses to the cloud.
     */
    constructor(command, connector) {
        if (!command || (command instanceof Array) ||
            typeof command !== 'object') {
            throw new Error('Invalid command specified (arg #1)');
        }

        if (typeof command.id !== 'string' || command.id.length <= 0) {
            throw new Error('Command does not define a valid id (command.id)');
        }

        if (typeof command.action !== 'string' || command.action.length <= 0) {
            throw new Error('Command does not define a valid action (command.action)');
        }

        if (!(connector instanceof CloudConnector)) {
            throw new Error('Invalid connector reference specified (arg #2)');
        }

        this._id = command.id;
        this._params = command.params || {};
        this._action = command.action;
        this._connector = connector;
        this._logger = _loggerProvider.getLogger(`request:${command.id}`);
    }

    /**
     * Sends a message to the cloud with the specified type and message.
     * 
     * @private
     * @param {String} type The message type to use.
     * @param {String} [message=''] An optional message to send.
     */
    _dispatch(type, message) {
        if (typeof message !== 'string') {
            message = '';
        }
        this._connector.addData({
            requestId: this._id,
            type: type,
            message: message
        });
    }

    /**
     * The request id associated with the request.
     *
     * @type {String}
     */
    get id() {
        return this._id;
    }

    /**
     * The request action associated with the request.
     *
     * @type {String}
     */
    get action() {
        return this._action;
    }

    /**
     * Gets the request parameter for the specified key.
     *
     * @param {String} key The param key
     * @return {any} The parameter associated with the key. If no parameter is
     *          defined for the key, an undefined will be returned.
     */
    getParam(key) {
        return this._params[key];
    }

    /**
     * Sends a message to the cloud. This does not imply that the request is
     * completed, but merely a status message to inform the cloud of some
     * action or state.
     *
     * @param {String} message The message to send to the cloud.
     */
    log(message) {
        if (typeof message !== 'string' || message.length <= 0) {
            throw new Error('Invalid message specified (arg #1)');
        }

        this._dispatch('log', message);
    }

    /**
     * Notifies the cloud that the request has been received.
     *
     * @param {String} [message=''] An optional message to send to the cloud.
     */
    acknowledge(message) {
        this._dispatch('acknowledge', message);
    }

    /**
     * Marks the request as being completed successfully.
     *
     * @param {String} [message=''] An optional message to send to the cloud.
     */
    finish(message) {
        this._dispatch('finish', message);
    }

    /**
     * Marks the request as being completed, but with errors.
     *
     * @param {String|Error} [error] An optional error object to send to the
     *          cloud.
     */
    fail(message) {
        if (message instanceof Error) {
            message = message.message;
        } else if (typeof message !== 'string' || message.length <= 0) {
            throw new Error('Invalid error specified (arg #1)');
        }
        this._dispatch('fail', message);
    }
}

module.exports = CncRequest;
