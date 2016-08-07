(function() {

    if (typeof exports != 'undefined' || typeof chrome == 'undefined') {
    	var ss = require("sdk/simple-storage").storage;

    	chrome = {
    		storage : {
    			sync : {
    				set : function(obj, callback) {
    					for (var key in obj) {
    						ss[key] = obj[key];
    					}

    					callback();
    				},

    				get : function(key, callback) {
    					var ret = {};
    					ret[key] = ss[key];

    					callback(ret);
    				},

    				remove : function(key, callback) {
    					delete ss[key];

    					callback();
    				},

    				clear : function(callback) {
    					for (var key in ss) {
    						delete ss[key];
    					}

    					callback();
    				}
    			}
    		},

    		runtime : {
    			lastError : false
    		}
    	};
    }



    // small wrapper for chrome.storage to add promises
    var storage = chrome.storage.sync;//local
    var runtime = chrome.runtime;

    ChromeStorage = {

      set: function(key, val) {
        return new Promise(function (resolve, reject) {
          var ob = {};
          ob[key] = val;
          storage.set(ob, function() {
            if (runtime.lastError) return reject(runtime.lastError);
            resolve(ob);
          });
        });
      },


      setObj: function(obj) {
        return new Promise(function (resolve, reject) {
          storage.set(obj, function() {
            if (runtime.lastError) return reject(runtime.lastError);
            resolve(obj);
          });
        });
      },

      // save only part of object
      //ChromeStorage.get('some_options').then( function(val) { console.log(val); })
      //-> {bPreventLeak: true, cur_list: "list1"}
      //ChromeStorage.setObjExt('some_options', {bPreventLeak:false})
      //ChromeStorage.get('some_options').then( function(val) { console.log(val); })
      //-> {bPreventLeak: false, cur_list: "list1"}
      setObjExt: function(key, obj) {
        return new Promise(function (resolve, reject) {
          storage.get(key, function (results) {

            if (key.trim !== undefined) results = results[key];
            if (runtime.lastError) return reject(runtime.lastError);

            var ob1 = {}, ob2 = {};
            ob1[key] = results;
            ob2[key] = obj;

            //console.log('key, obj:', key, obj);
            //console.log('ob1, ob2:', ob1, ob2);

            var un = $.extend(true, {}, ob1, ob2);

            //console.log('un:', un);

            storage.set(un, function() {
              if (runtime.lastError) return reject(runtime.lastError);
              resolve(un);
            });
          });
        });
      },

      get: function(key) {
        return new Promise(function (resolve, reject) {
          storage.get(key, function (results) {
            if (key.trim !== undefined) results = results[key];
            if (runtime.lastError) return reject(runtime.lastError);
            resolve(results);
          });
        });
      },

      all: function() {
        return new Promise(function (resolve, reject) {
          storage.get(null, function (items) {
            if (runtime.lastError) return reject(runtime.lastError);
            resolve(items);
          });
        });
      },

      remove: function(key) {
        if (key === undefined) throw new Error('No keys given to remove');
        return new Promise(function (resolve, reject) {
          storage.remove(key, function() {
            if (runtime.lastError) return reject(runtime.lastError);
            resolve();
          });
        });
      },

      clearAll: function() {
        return new Promise(function (resolve, reject) {
          storage.clear(function() {
            if (runtime.lastError) return reject(runtime.lastError);
            resolve();
          });
        });
      }

    };


    SyncStorage = {

      saveKey: function (key) {
        ChromeStorage.setObj({key:key});
      },

      getKey: function (cb) {
        ChromeStorage.get('key').then(
          function(val) {
            console.log('SyncStorage.ChromeStorage.get key =', val);
            cb(val);
          },
          function(err) {
            console.error(err);
            cb(null);
          }
        );
      }
    }

    if (typeof exports != 'undefined') {
        exports.ChromeStorage = ChromeStorage;
        exports.SyncStorage = SyncStorage;
    }
}());
