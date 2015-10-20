/* jshint node:true */
'use strict';

var _os = require('os');

/**
 * Networking utilities module.
 *
 * @module utils.network
 */
module.exports = {

    /**
     * Returns the IPv4 address of the specified network interface. If the
     * specified interface is not found, or does not have a valid ipv4 address,
     * an empty string will be returned.
     *
     * @param {String} name Name of the network interface
     * @return {String} The IPv4 address of the interface.
     */
    getIPv4Address: function(name) {
        var iface = _os.networkInterfaces()[name];

        var address = '';
        if(iface instanceof Array) {
            iface.forEach(function(config) {
                if(config.family === 'IPv4') {
                    address = config.address;
                }
            });
        }

        return address;
    }
};
