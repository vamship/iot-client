/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _shortId = require('shortid');
const _clone = require('clone');
const _assertionHelper = require('wysknd-test').assertionHelper;
const _tempFileHelper = require('../utils/temp-file-helper');
const ModuleLoader = require('../../lib/module-loader');

describe('ModuleLoader', () => {
    const DEFAULT_FACTORY_NAME = 'some_factory';

    function _createLoader(config, basePath, name) {
        config = config || {};
        name = name || DEFAULT_FACTORY_NAME;
        return new ModuleLoader(name, config, basePath);
    }

    function _createModuleConfig() {
        return {
            'moduleA': _tempFileHelper.createModuleFile('moduleA'),
            'moduleB': _tempFileHelper.createModuleFile('moduleB'),
            'moduleC': _tempFileHelper.createModuleFile('moduleC'),
            'moduleD': _tempFileHelper.createModuleFile('moduleD')
        };
    }

    beforeEach(() => {
        _tempFileHelper.setup();
    });

    afterEach(() => {
        _tempFileHelper.teardown();
    });

    describe('ctor()', () => {

        it('should throw an error if invoked without a valid factory name', () => {
            const error = 'Invalid factory name specified (arg #1)';

            function invoke(name) {
                return () => {
                    const loader = new ModuleLoader(name);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if invoked without a valid configuration object', () => {
            const error = 'Invalid type configuration specified (arg #1)';

            function invoke(config) {
                return () => {
                    const name = DEFAULT_FACTORY_NAME;
                    const loader = new ModuleLoader(name, config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if the module path is invalid', () => {
            function doTest(type, path) {
                const error = `Invalid module path specified for [${type}]`;

                function wrapper() {
                    const name = DEFAULT_FACTORY_NAME;
                    const config = {
                        'ValidType': _tempFileHelper.createModuleFile()
                    };
                    config[type] = path;
                    const loader = new ModuleLoader(name, config);
                }
                expect(wrapper).to.throw(error);
            }

            doTest('Foo', undefined);
            doTest('Foo', null);
            doTest('Foo', 123);
            doTest('Foo', '');
            doTest('Foo', true);
            doTest('Foo', []);
            doTest('Foo', {});
            doTest('Foo', () => {});
        });

        it('should throw an error if any of the module path does not reference an accessible file', () => {
            function doTest(type, path) {
                const error = `Cannot find module '${path}'`;

                function wrapper() {
                    const name = DEFAULT_FACTORY_NAME;
                    const config = {};
                    config[type] = path;
                    const loader = new ModuleLoader(name, config);
                }
                expect(wrapper).to.throw(error);
            }
            doTest('Foo', 'some/bad/path');
        });

        it('should return an object that exposes the required methods and properties', () => {
            const basePath = '/some/base/path';
            const name = DEFAULT_FACTORY_NAME;
            const loader = new ModuleLoader(name, {}, basePath);

            expect(loader).to.be.an('object');
            expect(loader.basePath).to.be.a('string').and.to.equal(basePath);
            expect(loader.getModule).to.be.a('function');
        });

        it('should default the base path to "./" if a valid base path is not specified', () => {
            function doTest(basePath) {
                const name = DEFAULT_FACTORY_NAME;
                const loader = new ModuleLoader(name, {}, basePath);
                expect(loader.basePath).to.equal('./');
            }

            doTest(undefined);
            doTest(null);
            doTest(123);
            doTest('');
            doTest(true);
            doTest([]);
            doTest({});
            doTest(() => {});
        });

        it('should create a map of types to modules when invoked', () => {
            const config = _createModuleConfig();
            const loader = _createLoader(config);

            expect(loader._typeMap).to.be.an('object');
            for (let type in config) {
                const path = config[type];
                const typeClass = require(path);
                expect(loader._typeMap[type]).to.equal(typeClass);
            }
        });

        it('should prepend the base path to paths that begin with "./", and resolve the path', () => {
            const origConfig = _createModuleConfig();
            const config = _clone(origConfig);

            var basePath = _tempFileHelper.getTempDir() + '/';
            for (let type in config) {
                config[type] = config[type].replace(basePath, './');
            }

            const loader = _createLoader(config, basePath);

            expect(loader._typeMap).to.be.an('object');
            for (let type in origConfig) {
                const path = origConfig[type];
                const typeClass = require(path);
                expect(loader._typeMap[type]).to.equal(typeClass);
            }
        });
    });

    describe('getModule()', () => {

        it('should throw an error if invoked without a valid module type', () => {
            const error = 'Invalid module type specified (arg #1)';

            function invoke(type) {
                const loader = _createLoader();
                return () => {
                    loader.getModule(type);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if the specified module type does not map to a valid module', () => {
            const loader = _createLoader();

            function doTest(type) {
                const error = `Specified type does not map to a valid module: [${type}]`;

                function wrapper() {
                    loader.getModule(type);
                }
                expect(wrapper).to.throw(error);
            }

            doTest('BAD_TYPE');
            doTest('BADDER_TYPE');
        });

        it('should return the module when invoked with a valid module type', () => {
            const ids = ['moduleA', 'moduleB', 'moduleC', 'moduleD'];
            const config = {};
            ids.forEach((id) => {
                config[id] = _tempFileHelper.createModuleFile(id);
            });
            const loader = _createLoader(config);

            ids.forEach((id) => {
                const module = loader.getModule(id);

                expect(module).to.be.an('object');
                expect(module.id).to.equal(id);
            });
        });
    });
});
