/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const ConfigVersionError = require('../../../lib/config/config-version-error');

describe('ConfigVersionError', () => {
    describe('ctor()', () => {
        it('should inherit from the Error object', () => {
            const error = new ConfigVersionError();

            expect(error).to.be.an.instanceof(Error);
            expect(error).to.have.property('expected').and.to.be.a('string');
            expect(error).to.have.property('actual').and.to.be.a('string');
        });

        it('should default expected version number to an empty string if a valid string is not specified', () => {
            function doTest(expected) {
                const error = new ConfigVersionError(expected);
                expect(error.expected).to.be.a('string').and.to.be.empty;
            }

            doTest(undefined);
            doTest(null);
            doTest(123);
            doTest(true);
            doTest([]);
            doTest({});
            doTest(() => {});
        });

        it('should set the expected version number to the specified value if the argument was a valid string', () => {
            function doTest(expected) {
                const error = new ConfigVersionError(expected);
                expect(error.expected).to.equal(expected);
            }

            doTest('version 1.0');
            doTest('1.0.0');
            doTest('1.0.0a');
            doTest('some version string');
            doTest('');
        });

        it('should default actual version number to an empty string if a valid string is not specified', () => {
            function doTest(actual) {
                const error = new ConfigVersionError('1.0.0', actual);
                expect(error.actual).to.be.a('string').and.to.be.empty;
            }

            doTest(undefined);
            doTest(null);
            doTest(123);
            doTest(true);
            doTest([]);
            doTest({});
            doTest(() => {});
        });

        it('should set the actual version number to the specified value if the argument was a valid string', () => {
            function doTest(actual) {
                const error = new ConfigVersionError('1.0.0', actual);
                expect(error.actual).to.equal(actual);
            }

            doTest('version 1.0');
            doTest('1.0.0');
            doTest('1.0.0a');
            doTest('some version string');
            doTest('');
        });
    });
});
