'use strict';

const _fs = require('fs');
const Promise = require('bluebird').Promise;
const _loggerProvider = require('../logger-provider');

/**
 * Base class that represents the data from a single config file. This class
 * provides basic methods to access/modify raw data, and to load/save data
 * from/to the file on the file system.
 *
 * Inheriting classes can augment this functionality for specific use cases.
 */
class ConfigFile {
    /**
     * @param {String} path The path to the actual file on the file system.
     */
    constructor(path) {
        if (typeof path !== 'string' || path.length <= 0) {
            throw new Error('Invalid file path specified (arg #1)');
        }

        /**
         * @type {Object}
         * @protected
         */
        this._logger = _loggerProvider.getLogger('config');

        this._path = path;
        this._data = null;
    }

    /**
     * Updates the raw data contents of the file with the data passed to this
     * function. This method is intended for consumption by child classes,
     * and should not be called directly by external code.
     *
     * @protected
     * @param {Object|String} data The data to be saved in the config file.
     */
    _setData(data) {
        this._data = data;
    }

    /**
     * Allows child classes to introduce post load processing of the data read
     * from the file system. Current implementation merely converts the input
     * buffer into a string. Child classes can override  this capability as
     * necessary.
     *
     * @protected
     * @param {Buffer} data The raw data read from the file system.
     * @return {String} A string representation of the buffer data.
     */
    _afterLoad(data) {
        if (data instanceof Buffer) {
            return data.toString();
        } else {
            return '';
        }
    }

    /**
     * Allows child classes to introduce pre save processing of the data before
     * it is written to the file system. Current implementation simply returns
     * the input without any changes. Child classes can override this
     * capability as necessary.
     *
     * @protected
     * @param {Object|String} data The raw data read from the file system.
     * @return {String} A string representation of the buffer data.
     */
    _beforeSave(data) {
        if (data === null || data === undefined) {
            return '';
        }
        return data.toString();
    }

    /**
     * Returns the raw data represented by this file. This value will default
     * to null if data has not yet been loaded from the file.
     *
     * @type {Object|String}
     */
    get data() {
        return this._data;
    }

    /**
     * Loads data from the config file, and populates it in the data
     * property.
     *
     * @return {Promise<undefined, Object>} A promise that is rejected or
     *              resolved based on the successful completion of the
     *              operation.
     */
    load() {
        return new Promise((resolve, reject) => {
            this._logger.info({
                path: this._path
            }, 'Loading data from file');
            _fs.readFile(this._path, (err, data) => {
                if (err) {
                    this._logger.error(err, 'Error loading data from file');
                    reject(err);
                } else {
                    this._logger.info('File data loaded successfully');
                    resolve(data);
                }
            });
        }).then((data) => {
            this._data = this._afterLoad(data);
        });
    }

    /**
     * Saves current file data from the object to the file system.
     *
     * @return {Promise<undefined, Object>} A promise that is rejected or
     *              resolved based on the successful completion of the
     *              operation.
     */
    save() {
        return new Promise((resolve, reject) => {
            const contents = this._beforeSave(this._data);
            this._logger.info({
                path: this._path
            }, 'Saving data to file');
            _fs.writeFile(this._path, contents, (err, data) => {
                if (err) {
                    this._logger.error(err, 'Error saving data to file');
                    reject(err);
                } else {
                    this._logger.info('File data saved successfully');
                    resolve();
                }
            });
        });
    }
}


module.exports = ConfigFile;
