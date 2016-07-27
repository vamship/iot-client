'use strict';

const Connector = require('./connector');

/**
 * Base class that represents a connector object that is specifically designed
 * to communicate with the cloud.
 *
 * @extends {Connector}
 *
 * @emits {data} When the connector has data to report
 */
class CloudConnector extends Connector {

    /**
     * @param {String} id A unique id for the connector.
     * @param {Object} config A configuration object for the connector.
     */
    constructor(id, config) {
        super(id, 'cloud', config);

        this._buffer = [];
    }

    /**
     * Returns a reference to the connector's internal data buffer.
     *
     * @type {Array}
     */
    get buffer() {
        return this._buffer;
    }

    /**
     * Adds data to the connector's buffer, queueing it for dispatch to the
     * cloud.
     *
     * @param {Object} data The data to add to the connector's buffer.
     */
    addData(data) {
        if (!data || (data instanceof Array) || typeof data !== 'object') {
            throw new Error('Invalid data object specified (arg #1)');
        }
        this._logger.debug('Pushing data into buffer');
        this._buffer.push(data);
    }
}

module.exports = CloudConnector;
