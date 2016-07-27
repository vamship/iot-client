/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _fs = require('fs');
const _path = require('path');
const _shortId = require('shortid');
const _tempFileHelper = require('../../utils/temp-file-helper');
const _assertionHelper = require('wysknd-test').assertionHelper;
const Promise = require('bluebird').Promise;

const ConfigFile = require('../../../lib/config/config-file');

describe('ConfigFile', () => {
    const TMP_DIR = '.tmp';
    const DEFAULT_CONFIG_DATA = '{ "config": "data" }';
    const DEFAULT_CONFIG_PATH = 'foo/bar/config.file';

    function _createConfigFileObject(path) {
        path = path || DEFAULT_CONFIG_PATH;
        return new ConfigFile(path);
    }

    beforeEach(() => {
        _tempFileHelper.setup();
    });

    afterEach(() => {
        _tempFileHelper.teardown();
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid file path', () => {
            const error = 'Invalid file path specified (arg #1)';

            function invoke(config) {
                return () => {
                    const file = new ConfigFile(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should return an object that exposes the required methods and properties', () => {
            const file = _createConfigFileObject();

            expect(file).to.be.an('object');
            expect(file._setData).to.be.a('function');
            expect(file._afterLoad).to.be.a('function');
            expect(file._beforeSave).to.be.a('function');

            expect(file.data).to.be.null;
            expect(file.load).to.be.a('function');
            expect(file.save).to.be.a('function');
        });
    });

    describe('_setData()', () => {
        it('should update the raw data with the specified data when called', () => {
            const configData = DEFAULT_CONFIG_DATA;
            const file = _createConfigFileObject();

            expect(file.data).to.be.null;
            file._setData(configData);
            expect(file.data).to.equal(configData);
        });
    });

    describe('_afterLoad()', () => {
        it('should return an empty string if the input is not a buffer', () => {
            function doTest(value) {
                const file = _createConfigFileObject();
                expect(file._afterLoad(value)).to.be.a('string').and.to.be.empty;
            }

            doTest(undefined);
            doTest(null);
            doTest(123);
            doTest('');
            doTest(true);
            doTest({});
            doTest([]);
            doTest(() => {});
        });

        it('should return a string version of the buffer if the input is a buffer', () => {
            const stringValue = 'some text';
            const buffer = new Buffer(stringValue);
            const file = _createConfigFileObject();

            expect(file._afterLoad(buffer)).to.equal(stringValue);
        });
    });

    describe('_beforeSave()', () => {
        it('should return an empty string if the input value is null or undefined', () => {
            function doTest(value) {
                const file = _createConfigFileObject();
                expect(file._beforeSave(value)).to.be.a('string').and.to.be.empty;
            }

            doTest(undefined);
            doTest(null);
        });

        it('should return a string version of the input value if it is not null or undefined', () => {
            function doTest(value) {
                const file = _createConfigFileObject();
                expect(file._beforeSave(value)).to.equal(value.toString());
            }

            doTest(123);
            doTest('');
            doTest(true);
            doTest({});
            doTest(new Buffer('some text'));
            doTest([]);
            doTest(() => {});
        });
    });

    describe('load()', () => {
        it('should return a promise when invoked', () => {
            const filePath = _tempFileHelper.createConfigFile();
            const file = _createConfigFileObject(filePath);

            const ret = file.load();
            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should reject the promise if an error occurs when reading the config file', (done) => {
            const file = _createConfigFileObject();

            const ret = file.load();
            expect(ret).to.be.rejected.and.notify(done);
        });

        it('should load the contents of the config file from the specified path', (done) => {
            const contents = '__dummy_config_contents__';
            const filePath = _tempFileHelper.createConfigFile(contents);
            const file = _createConfigFileObject(filePath);

            expect(file.data).to.be.null;
            const ret = file.load();

            function doTest() {
                expect(file.data).to.equal(contents);
            }

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should invoke the _afterLoad() function after config file data has been loaded', (done) => {
            const contents = '__dummy_config_contents__';
            const filePath = _tempFileHelper.createConfigFile(contents);
            const file = _createConfigFileObject(filePath);

            const spy = _sinon.stub(file, '_afterLoad');

            expect(spy).to.not.have.been.called;
            const ret = file.load();

            function doTest() {
                expect(spy).to.have.been.calledOnce;
                const inputBuffer = spy.args[0][0];
                expect(inputBuffer).to.be.an.instanceof(Buffer);
                expect(inputBuffer.toString()).to.equal(contents);
            }

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if there was an error executing _afterLoad()', (done) => {
            const error = new Error('something went wrong');
            const filePath = _tempFileHelper.createConfigFile();
            const file = _createConfigFileObject(filePath);

            const spy = _sinon.stub(file, '_afterLoad', () => {
                throw error;
            });

            const ret = file.load();

            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });
    });

    describe('save()', () => {
        it('should return a promise when invoked', () => {
            const filePath = _tempFileHelper.generateFilePath('.config', true);
            const file = _createConfigFileObject(filePath);

            const ret = file.save();
            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should reject the promise if an error occurs when saving the config file', (done) => {
            const badPath = 'this/path/does/not/exist.config';
            const file = _createConfigFileObject(badPath, true);

            const ret = file.save();
            expect(ret).to.be.rejected.and.notify(done);
        });

        it('should create a new file and write the contents object to it if the file does not exist', (done) => {
            const contents = '__dummy_config_contents__';
            const filePath = _tempFileHelper.generateFilePath('.config', true);
            const file = _createConfigFileObject(filePath);

            file._setData(contents);
            const promise = new Promise((resolve, reject) => {
                _fs.accessSync(filePath);
            });

            function doTest() {
                const fileContents = _fs.readFileSync(filePath, 'utf-8');
                expect(fileContents).to.equal(contents);
            }

            expect(promise).to.be.rejected
                .then(file.save.bind(file))
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should overwrite the config file with the contents of the object if the file already exists', (done) => {
            const contents = '__dummy_config_contents__';
            const filePath = _tempFileHelper.generateFilePath('.config', true);
            const file = _createConfigFileObject(filePath);

            file._setData(contents);
            const promise = new Promise((resolve, reject) => {
                _fs.writeFileSync(filePath, 'some bad contents');
                resolve();
            });

            function doTest() {
                const fileContents = _fs.readFileSync(filePath, 'utf-8');
                expect(fileContents).to.equal(contents);
            }

            expect(promise).to.be.fulfilled
                .then(file.save.bind(file))
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should invoke the _beforeSave() function before config data is saved', (done) => {
            const contents = '__dummy_config_contents__';
            const filePath = _tempFileHelper.createConfigFile();
            const file = _createConfigFileObject(filePath);

            file._setData(contents);
            const spy = _sinon.stub(file, '_beforeSave');

            expect(spy).to.not.have.been.called;
            const ret = file.save();

            function doTest() {
                expect(spy).to.have.been.calledOnce;
                expect(spy).to.have.been.calledWith(contents);
            }

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if there was an error executing _beforeSave()', (done) => {
            const error = new Error('something went wrong');
            const filePath = _tempFileHelper.createConfigFile();
            const file = _createConfigFileObject(filePath);

            const spy = _sinon.stub(file, '_beforeSave', () => {
                throw error;
            });

            const ret = file.save();

            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });
    });
});
