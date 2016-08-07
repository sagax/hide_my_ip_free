const { Cc, Ci } = require('chrome');
const nsIProtocolProxyService = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);

/**
 * @constructor
 */
function Connector() {
  this.setState(false);
}

Connector.prototype = {
  /**
   * @returns {{applyFilter, register, unregister}}
   */
  service: function () {
    return (function (that) {
      return {
        applyFilter: function (th, uri, proxy) {
          var __uri = uri.host;

          var allLinks = ['api.hide-my-ip.com'];

          if (!that.isEnabled() || allLinks.indexOf(__uri) != -1 || __uri.indexOf('hide-my-ip.com') != -1) {
            return proxy;
          }

          var aType = that.address.getProxyProtocol();
          if (aType == 'socks5') {
            aType = 'socks';
          }

          var host = that.address.getIPAddress();

          //!! http://stackoverflow.com/questions/29735062/firefox-extension-set-proxy-auth/35391058

          return nsIProtocolProxyService.newProxyInfo(aType, host, that.address.getPort(), 0, -1, null);
        },
        register: function () {
          nsIProtocolProxyService.registerFilter(this, 0);
        },
        unregister: function () {
          nsIProtocolProxyService.unregisterFilter(this);
        }
      };
    })(this);
  },
  /**
   * @param {Address} endpoint
   * @returns {void}
   */
  start: function (endpoint) {
    this.address = endpoint;
    this.service().register();
    this.setState(true);
  },
  /**
   * @returns {void}
   */
  stop: function () {
    //!!  firefox bug
    //!!! this.service().unregister();
    this.setState(false);
  },
  /**
   * @param {Boolean} state
   */
  setState: function (state) {
    this.iEnabled = state;
  },
  /**
   * @returns {Boolean}
   */
  isEnabled: function () {
    return this.iEnabled;
  }
};

exports.Connector = Connector;

