var ProxyAdapter = {
  connector : null,

  // type 1 - usual, 2 - socks5
  setProxy: function (host, port, type, pass) {
    var config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'http',
          host: host,
          port: port
        },
        bypassList: ['https://api.hide-my-ip.com']
      }
    };

    if (type && type === 2) {
      config = {
        mode: 'fixed_servers',
        rules: {
          singleProxy: {
            scheme: 'socks5', //  <<<
            host: host,
            port: port
          },
          bypassList: ['https://api.hide-my-ip.com']
        }
      };
    }
    this._applyProxySettings(config, pass);
  },

  removeProxy: function() {
    var config = {
      mode: 'direct'
    };
    this._applyProxySettings(config, '');
  },

  _applyProxySettings: function(config, pass) {
    if (typeof chrome == 'undefined') {
      var ffchrome = require("chrome");
      var CC = ffchrome.CC;
      var Cc = ffchrome.Cc;
      var Ci = ffchrome.Ci;

      const { Address } = require('./Address.js');
      const { Connector } = require('./Connector.js');

      var isDirect = config.mode == 'direct';

      //!!! firefox bug
      this.connector = !this.connector ? new Connector() : this.connector;
      if (isDirect) {
        this.connector.stop();
      } else {
        //---------------------
        if (pass) {
          var idnService = Cc["@mozilla.org/network/idn-service;1"].
            getService(Ci.nsIIDNService);
          var hostname = "moz-proxy://" +
            idnService.convertUTF8toACE(config.rules.singleProxy.host) +
            ":" + config.rules.singleProxy.port;

          var realm = "HMIP";//hostname;
          var LoginInfo = new CC("@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo, "init");
          var loginInfo = new LoginInfo(
              hostname,
              null,
              realm,
              pass,
              pass,
              '',
              ''
              );
          var loginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
          var logins = loginManager.findLogins({}, hostname, null, realm);
          for (var i = 0; i < logins.length; i++) {
            if (logins[i].username == pass) {
              loginManager.removeLogin(loginInfo);
              break;
            }
          }

          loginManager.addLogin(loginInfo);
        }
        //---------------------

        this.connector.start(new Address(config.rules.singleProxy.host, config.rules.singleProxy.port, config.rules.singleProxy.scheme, config.rules.singleProxy.country, pass));
      }
    } else {
      chrome.proxy.settings.set({
        value: config,
        scope: 'regular'
      },
      function () {}
      );
    }
  }
};

if (typeof exports != 'undefined') {
  exports.ProxyAdapter = ProxyAdapter;
}

