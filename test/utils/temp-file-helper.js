/* jshint node:true, expr:true */

const _fs = require('fs');
const _path = require('path');
const _shortId = require('shortid');
const _fsHelper = require('wysknd-test').fs;

const _filesToCleanup = [];
const TEMP_DIR = '.tmp';

const mod = {

    /**
     * Returns a resolved path to the temporary directory.
     *
     * @return {String} The resolved path to the temp directory.
     */
    getTempDir: function() {
        return _path.resolve(TEMP_DIR);
    },

    /**
     * Creates a folder for temporary files if one does not exist.
     */
    setup: function() {
        _fsHelper.createFolders(TEMP_DIR);
    },

    /**
     * Cleans up temporary files created by this module.
     */
    teardown: function() {
        if (_filesToCleanup.length > 0) {
            _fsHelper.cleanupFiles(_filesToCleanup);
        }
        _fsHelper.cleanupFolders(TEMP_DIR);

        _filesToCleanup.splice(0);
    },

    /**
     * Generates the path to a specific file inside the temporary directory.
     * Note that an actual file will **not** be created by this method.
     *
     * @param {String} [name] Optional name for the file or extension for the
     *          file. If omitted, a random file name with no extension will be
     *          generated. If specified with a leading ".", the value will be
     *          used as an extension with a random file name. Any other value
     *          will be used as an absolute name for the file.
     * @param {Boolean} [markForDelete = false] An optional value that can mark
     *          the generated file for cleanup, even though this method does
     *          not actually create the file.
     * @return {String} The path to the file on the file system.
     */
    generateFilePath: function(name, markForDelete) {
        if (typeof name !== 'string' || name.length <= 0) {
            name = _shortId.generate();
        } else if (name.startsWith('.')) {
            name = `${_shortId.generate()}${name}`;
        }
        const filePath = _path.resolve(TEMP_DIR, name);

        if (!!markForDelete) {
            _filesToCleanup.push(filePath);
        }

        return filePath;
    },

    /**
     * Creates a new file in the temporary directory, with the specified name,
     * and contents.
     *
     * This file will be tracked, and removed when "teardown()" is called. The
     * "setup()" method must be called before invoking this method to ensure
     * that the temporary directory for files is created.
     *
     * @param {String} [contents] Optional contents of the file - will be
     *          defaulted to an empty string if omitted.
     * @param {String} [name] Optional name for the file or extension for the
     *          file. If omitted, a random file name with no extension will be
     *          generated. If specified with a leading ".", the value will be
     *          used as an extension with a random file name. Any other value
     *          will be used as an absolute name for the file.
     * @return {String} Path to the file on the file system.
     */
    generateFile: function(contents, name) {
        contents = contents || '';
        const filePath = mod.generateFilePath(name);

        _fsHelper.createFiles({
            path: filePath,
            contents: contents
        });
        _filesToCleanup.push(filePath);

        return filePath;
    },

    /**
     * Generates code for a single module and writes it to a temporary file.
     *
     * This file will be tracked, and removed when "teardown()" is called. The
     * "setup()" method must be called before invoking this method to ensure
     * that the temporary directory for files is created.
     *
     * @param {String} [id] An optional module id. An auto generated id
     *          will be used if this parameter is not specified.
     * @return {String} Path to the file on the file system.
     */
    createModuleFile: function(id) {
        id = id || _shortId.generate();
        const contents = [
            `'use strict';`,
            `module.exports = {`,
            `    id: '${id}'`,
            `}`
        ];

        return mod.generateFile(contents.join('\n'), '.js');
    },

    /**
     * Generates code for a connecotr, and writes it to a temporary file.
     *
     * This file will be tracked, and removed when "teardown()" is called. The
     * "setup()" method must be called before invoking this method to ensure
     * that the temporary directory for files is created.
     *
     * @param {String} connectorClass Name of the connector class.
     * @param {String} connectorType Type of connector. Typically "cloud"
     *          or "device".
     * @return {String} Path to the file on the file system.
     */
    createConnectorFile: function(connectorClass, connectorType) {
        const contents = [
            `'use strict';`,
            `const Connector = require('../lib/connectors/connector.js');`,
            `class ${connectorClass} extends Connector {`,
            `    constructor(id, config) {`,
            `        super(id, '${connectorType}', config);`,
            `    }`,
            `}`
        ];

        return mod.generateFile(contents.join('\n'), '.js');
    },

    /**
     * Generates contennts for a dummy config file and writes it to a temporary
     * file.
     *
     * This file will be tracked, and removed when "teardown()" is called. The
     * "setup()" method must be called before invoking this method to ensure
     * that the temporary directory for files is created.
     *
     * @param {String} [contents = '{ "config": "data" }' ] Optional contents of
     *          the config file.
     * @param {String} [name] Optional name of the config file. A random name
     *          will be generated if this value is omitted.
     * @return {String} Path to the file on the file system.
     */
    createConfigFile: function(contents, name) {
        contents = contents || JSON.stringify({
            config: 'data'
        });
        name = name || '.config';

        return mod.generateFile(contents, name);
    },

};

module.exports = mod;
