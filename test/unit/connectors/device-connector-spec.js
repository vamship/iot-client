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
const DeviceConnector = require('../../../lib/connectors/device-connector');

describe('DeviceConnector', () => {

    function _createConnector(id, config) {
        id = id || _shortId.generate();
        config = config || {};

        return new DeviceConnector(id, config);
    }

    describe('ctor()', () => {
        it('should return an object with expected members when invoked with correct parameters', () => {
            const id = 'device_connector_1';
            const config = {
                foo: 'bar',
                abc: 123
            };
            const connector = new DeviceConnector(id, config);

            expect(connector).to.be.an('object');
            expect(connector).to.be.an.instanceof(Connector);

            expect(connector.id).to.be.a('string').and.to.equal(id);
            expect(connector.type).to.be.a('string').and.to.equal('device');
            expect(connector.config).to.deep.equal(config);
        });
    });
});
