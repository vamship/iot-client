'use strict';

const _clone = require('clone');
const _loggerProvider = require('./logger-provider');

/**
 * Class that triggers a registered event handler at periodic intervals.
 */
class Poller {

    /**
     * @param {String} id A unique id for the poller (used in logging).
     * @param {Number} frequency The frequency at which intervals are
     *          triggered.
     * @param {Function} handler A routine that is triggered at each interval.
     */
    constructor(id, frequency, handler) {
        if (typeof id !== 'string' || id.length <= 0) {
            throw new Error('Invalid id specified (arg #1)');
        }
        if (typeof frequency !== 'number' || frequency <= 0) {
            throw new Error('Invalid polling frequency specified (arg #2)');
        }
        if (typeof handler !== 'function') {
            throw new Error('Invalid handler specified (arg #3)');
        }
        this._isActive = false;

        this._id = id;
        this._frequency = frequency;
        this._handler = handler;
        this._intervalHandle = null;

        this._logger = _loggerProvider.getLogger({
            group: `poller:${id}`
        });
    }

    /**
     * Determines if the poller is currently active, meaning that polling has
     * started, and is triggering at regular intervals.
     *
     * @type {Boolean}
     */
    get isActive() {
        return this._isActive;
    }

    /**
     * Starts the poller, which will now trigger at the polling frequency.
     */
    start() {
        if (this._isActive) {
            throw new Error('Cannot start poller. Poller is already active');
        }

        this._logger.info('Starting poller');
        this._intervalHandle = setInterval(() => {
            this._logger.info('Triggering handler');
            this._handler();
        }, this._frequency);
        this._isActive = true;
    }

    /**
     * Stops a currently active poller.
     */
    stop() {
        if (!this._isActive) {
            throw new Error('Cannot stop poller. Poller is not active');
        }
        this._logger.info('Stopping poller');
        clearInterval(this._intervalHandle);
        this._isActive = false;
    }
}

module.exports = Poller;
