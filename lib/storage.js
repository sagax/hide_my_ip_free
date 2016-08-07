var Storage = {
  saveProxy: function (proxy) {
    if (proxy) {
      var o = {
        country: proxy.country,
        name: proxy.name,
        host: proxy.host,
        port: proxy.port,
        pass: proxy.pass,
        list: proxy.list
      };
      if (typeof localStorage == "undefined") {
        var ss = require("sdk/simple-storage");
        ss.storage.proxy = o;
      } else {
        localStorage.setItem("proxy", JSON.stringify(o));
      }
    }
    else {
      if (typeof localStorage == "undefined") {
        var ss = require("sdk/simple-storage");
        delete ss.storage.proxy;
      } else {
        localStorage.removeItem("proxy");
      }
    }
  },

  getProxy: function (proxy) {
    if (typeof localStorage == "undefined") {
      var ss = require("sdk/simple-storage");
      var storedProxy = ss.storage.proxy;
      return storedProxy;
    } else {
      var storedProxy = localStorage.getItem("proxy");
      return storedProxy && JSON.parse(storedProxy);
    }
  },

  saveKey: function (key) {
    ChromeStorage.setObj({key:key});
  },

  getKey: function () {
    ChromeStorage.get("key").then(
        function(val) {
          console.log("Storage.ChromeStorage.get key =", val);
          if (val === undefined) { // no saved key
            return null;
          } else {
            return val;
          }
        },
        function(err) {
          console.error(err);
          return null;
        }
    );
  }
};

if (typeof exports != "undefined") {
  exports.Storage = Storage;
}

