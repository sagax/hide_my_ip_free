if (typeof chrome == 'undefined') {
  var MC = function() {
    var that = this;
    addon.port.on("message", function(message) {
      that.msg_handler(message);
    });
  };

  MC.prototype = {
    messages_callbacks: [],
    func_sendMessage: function(msg, field, value, callback) {
      this.messages_callbacks.push({
        "func": msg,
        "field": field,
        "callback": callback
      });

      port_sendMessage({"doing": "function", "func": msg, "field": field, "value": value});
    },

    msg_handler: function(msg) {
      var that = this;

      if (msg.doing == 'answer_function') {
        var c = this.messages_callbacks;
        var j = get_el_by_fields(c, {
          "func": msg.func,
          "field": msg.field
        }
        );

        if (j != -1) {
          var callback = c.splice(j, 1);
          callback[0]['callback'].call(that, msg.value);
        }
      }
    }
  };

  var mc = new MC();
  window.chrome = {
    storage: {
      sync: {
        set: function(obj, callback) {
          mc.func_sendMessage('storage.set', 'obj', obj, function() {
            callback();
          });
        },

        get: function(key, callback) {
          mc.func_sendMessage('storage.get', 'key', key, function(val) {
            callback(val);
          });
        },

        remove: function(key, callback) {
          mc.func_sendMessage('storage.remove', 'key', key, function() {
            callback();
          });
        },

        clear: function(callback) {
          mc.func_sendMessage('storage.clear', 'all', '', function() {
            callback();
          });
        }
      }
    },

    runtime: {
      lastError: false
    }
  };
}
