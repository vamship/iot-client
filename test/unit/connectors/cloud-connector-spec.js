/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _shortId = require('shortid');
const _assertionHelper = require('wysknd-test').assertionHelper;
const Promise = require('bluebird').Promise;

const Connector = require('../../../lib/connectors/connector');
const CloudConnector = require('../../../lib/connectors/cloud-connector');

describe('CloudConnector', () => {

    function _createConnector(id, config) {
        id = id || _shortId.generate();
        config = config || {};

        return new CloudConnector(id, config);
    }

    describe('ctor()', () => {
        it('should return an object with expected members when invoked with correct parameters', () => {
            const id = 'cloud_connector_1';
            const config = {
                foo: 'bar',
                abc: 123
            };
            const connector = new CloudConnector(id, config);

            expect(connector).to.be.an('object');
            expect(connector).to.be.an.instanceof(Connector);

            expect(connector.id).to.be.a('string').and.to.equal(id);
            expect(connector.type).to.be.a('string').and.to.equal('cloud');
            expect(connector.config).to.deep.equal(config);
            expect(connector.buffer).to.be.an('Array').and.to.be.empty;

            expect(connector.addData).to.be.a('function');
        });
    });

    describe('addData()', () => {
        it('should throw an error if invoked without a valid data object', () => {
            const error = 'Invalid data object specified (arg #1)';

            function invokeMethod(data) {
                return () => {
                    const con = _createConnector();
                    con.addData(data);
                };
            }

            expect(invokeMethod()).to.throw(error);
            expect(invokeMethod(null)).to.throw(error);
            expect(invokeMethod(123)).to.throw(error);
            expect(invokeMethod('abc')).to.throw(error);
            expect(invokeMethod(true)).to.throw(error);
            expect(invokeMethod([])).to.throw(error);
            expect(invokeMethod(function() {})).to.throw(error);
        });

        it('should add data to the internal buffer when invoked with a valid data object', () => {
            const expectedBuffer = [];
            const con = _createConnector();

            expect(con.buffer).to.be.empty;
            for (let index = 0; index < 10; index++) {
                let data = {
                    foo: 'bar-' + index
                };
                con.addData(data);
                expectedBuffer.push(data);
            }
            expect(con._buffer).to.deep.equal(expectedBuffer);
        });
    });
});
