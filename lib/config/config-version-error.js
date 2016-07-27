'use strict';

/**
 * Error object that represents an error due to mismatched config version
 * numbers.
 *
 * @extends {ConfigFile}
 */
class ConfigVersionError extends Error {
    /**
     * @param {String} expected The expected version number or range
     * @param {String} actual The actual version number
     */
    constructor(expected, actual) {
        super(`Invalid config version. Expected [${expected}], got [${actual}]`);
        this._expected = '';
        this._actual = '';

        if (typeof expected === 'string') {
            this._expected = expected;
        }

        if (typeof actual === 'string') {
            this._actual = actual;
        }
    }

    /**
     * Gets the expected version of the configuration.
     *
     * @type {String}
     */
    get expected() {
        return this._expected;
    }

    /**
     * Gets the expected version of the configuration.
     *
     * @type {String}
     */
    get actual() {
        return this._actual;
    }
}

module.exports = ConfigVersionError;
