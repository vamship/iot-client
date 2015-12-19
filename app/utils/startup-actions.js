/* jshint node:true */
'use strict';

/**
 * Defines a list of recognized CNC actions.
 *
 * @module cncActions
 */
module.exports = {
    /**
     * CNC action that indicates that no action need be taken.
     *
     * @module cncActions
     * @property NO_ACTION
     * @readonly
     */
    NO_ACTION: 'startup_no_action',

    /**
     * CNC action to enter provision mode.
     *
     * @module cncActions
     * @property PROVISION_MODE
     * @readonly
     */
    PROVISION_MODE: 'startup_provision_mode'
};
