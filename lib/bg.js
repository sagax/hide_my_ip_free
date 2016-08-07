//var savedPolicyVal = chrome.privacy.IPHandlingPolicy.DEFAULT;
//chrome.privacy.network.webRTCIPHandlingPolicy.get({}, function(details) {
//  savedPolicyVal = details.value;
//});


var Proxy = function (host, port, country, name, list) {
  this.country = country;
  this.name = name;
  this.host = host;
  this.port = port;
  this.pass = null;
  this.list = list;
};



/* The object managing all proxies */
var ProxyManager = {

	uniqueid : null,

  	proxies: [],
  	recent_proxies: { list1:[], list2:[] }, // list1 = default, list2 = experimental

  	FF : {},
  	isFF : false,
    browserAction : {icon:{}},

	i18n_keys : [
       "oops_msg",
       "success_msg",
       "btn_back",
       "btn_enter_license_key",
       "textarea_placeholder",
       "btn_more_locations",
       "btn_buy",
       "btn_enter",
       "badger1",
       "badger2",
       "please_upgrade_msg",
       "please_select_another_msg",
       "invalid_key_msg",
       "success_key_msg",
       "btn_more",
       "btn_change"
	],


	setUnqiueToken : function(cb) {
      	var that = this;

       	if (typeof chrome == 'undefined') {
    		ChromeStorage = require("./chrome-storage").ChromeStorage;
    	}

        ChromeStorage.get('uniqueid').then( function(uniqueid) {
        	if (uniqueid) {
              	that.uniqueid = uniqueid;
            } else {
              	that.uniqueid = that.getRandomToken();

				ChromeStorage.set({uniqueid: that.uniqueid});
            }

            cb(that.uniqueid);
        });
	},


  	init: function () {
      	var that = this;

    	if (typeof chrome == 'undefined') {
    		this.isFF = true;
    	}


    	if (!this.isFF) {
            function onAuthRequest(details) {
              //console.log('details.isProxy=', details.isProxy,
              //            '    pass=', ProxyManager.activeProxy.pass)
              if (details.isProxy && that.activeProxy && that.activeProxy.pass) {
                return { authCredentials: {username: that.activeProxy.pass,
                                           password: that.activeProxy.pass}
                       }
              } else {
                return {}
              }
            }
            chrome.webRequest.onAuthRequired.addListener(onAuthRequest,  {urls: ["<all_urls>"]}, ['blocking']);


            chrome.runtime.onConnect.addListener(function(port) {
                if (port.name == 'hidemyip') {
                    port.onMessage.addListener(function(msg) {
                     	that.msg_handler(msg, port);
                    });
                }
            });

		    that.Storage = Storage;
		    that.ProxyAdapter = ProxyAdapter;
		    that.DataService = DataService;

			this.timer = window;


	        this.$ = jQuery;
    	    this.$.ajaxSettings.timeout = this.requestTimeout;


    	} else {
            var ffchrome = require("chrome");
            var Cc = ffchrome.Cc;
            var Ci = ffchrome.Ci;

			this.timer = require("sdk/timers");

    		this.FF.data = require("sdk/self").data;
    		this.FF.ss = require("sdk/simple-storage").storage;

            const self = require('sdk/self');
            const { ToggleButton } = require("sdk/ui/button/toggle");
            const { Panel } = require("sdk/panel");

			that.prefs_media_peerconnection = Cc["@mozilla.org/preferences-service;1"]
                    .getService(Ci.nsIPrefService).getBranch("media.peerconnection.");


			that.panelCreate();

            that.browserAction.button = ToggleButton({
                id: "hidemyip-action",
                label: "Hide My IP",
                icon: {
                    "16": "./img/icon.png"
                },
                onClick: function () {
                    that.FF.panel.show({
                        position: that.browserAction.button
                    });

                }
            });


		    that.Storage = require("./storage").Storage;
		    that.ProxyAdapter = require("./proxyAdapter").ProxyAdapter;
		    that.DataService = require("./dataService").DataService;



	        this.$ = {};

    		var request = require("sdk/request");
			this.parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);

	        this.$.ajax = function(options) {
              	var method = options.method.toLowerCase();

              	var content = [];
              	var data = options.data || {};
              	for (var i in data) {
              		content.push(i+'='+data[i]);
              	}

              	if (!content.length) {
              		content = "";
              	} else {
	              	content = '&'+content.join('&');
              	}

              	var requestOptions = {
                	url: options.url,
                	content: content,
                	contentType: options.contentType || "application/x-www-form-urlencoded",
                	onComplete: function(response) {
                		var status = response.status;
                		var text = response.text;

                		if (status == 200) {

			              	if (options.dataType == 'xml') {
					    		text = that.parser.parseFromString(that.xmlPrepare(text), "application/xml");
			              	}

	                		options.success(text);
	                	} else {
	                		options.error(text);
	                	}
                	}
              	};

              	if (options.dataType == 'xml') {
                	requestOptions['overrideMimeType'] = "text/xml";
              	}

            	var req = request.Request(requestOptions);


              	if (method == 'get') {
	        	    req.get();
	        	}

              	if (method == 'post') {
	        	    req.post();
	        	}
	        }

    	}




        this.activeProxy = that.Storage.getProxy();

        console.log('ProxyManager init, this.activeProxy=', this.activeProxy);


        if (!this.activeProxy) {
        	that.clearProxy();
		} else {

			if (that.isFF) {
    	        that.setProxy(that.activeProxy, function(ret) {
    	        });
    	    }

          	that.enableWebRTCLeakPreventing(true);
        }
        this._updateIcon();
        this.requestProxies();
  	},


	panelCreate : function() {
		var that = this;

		var contentURL = that.FF.data.url('html/popup.html');

        that.FF.panel = require("sdk/panel").Panel({
            height: 420,
            width: 380,

            contentURL: contentURL,

            contentScriptWhen: 'start',

            onShow: function() {
            },

            onHide: function() {
            	that.FF.panel.destroy();
   	        	that.panelCreate();
            }
        });

        that.FF.panel.port.on("message", function (message) {
            that.msg_handler(message);
        });
	},



    msg_handler : function(msg, port) {
    	var that = this;

        if (msg.doing == 'core_answer_function') {
            var c = this.messages_callbacks;
            var j = get_el_by_fields(c, {
        		"func" 		: msg.func,
        		"value" 	: msg.field
        		}
        	);

        	if (j != -1) {
        		var callback = c.splice(j, 1);
        		callback[0]['callback'].call(that, msg.value);
        	}
        }

        if (msg.doing == 'popup_ignition') {
			that.setUnqiueToken(function(uniqueid) {
				console.log(uniqueid);
				that.port_sendMessage({"doing": "ignition_ok", "coreInfo" : {"uniqueid" : uniqueid}});
            })
        }

        if (msg.doing == 'requestProxies') {
	        that.requestProxies();
        }

        if (msg.doing == 'clearProxy') {
	        that.clearProxy();
        }



        //---------
        if (msg.doing == 'function') {

            //---------
            if (msg.func == 'init') {

            	var i18n = {};

            	var locGet = !that.isFF ? chrome.i18n.getMessage : require("sdk/l10n").get;

            	for (var i=0; i < that.i18n_keys.length; i++) {
            		i18n[that.i18n_keys[i]] = locGet(that.i18n_keys[i]);
            	}

               	if (typeof chrome == 'undefined') {
            		SyncStorage = require("./chrome-storage").SyncStorage;
            	}

                SyncStorage.getKey(function(key) {
                	var ret = {
                		"activeProxy" : that.activeProxy,
                		"i18n" : i18n,
                		"key" : key
                	};
       				that.func_send_message(msg, ret);
                });
            }
            //---------
            if (msg.func == 'getProxies') {
	            var proxies = that.getProxies();
   				that.func_send_message(msg, proxies);
            }
            //---------
            if (msg.func == 'checkKey') {
            	var key = msg.value;

              var url = 'https://api.hide-my-ip.com/chrome.cgi?action=keycheck&key=' + key;
              console.log('checkKey, key=', key);
              that.$.ajax({
                method: 'GET',
                url: url,
                success: function (data) {
                  //console.log(data.length)
                  console.log(data)

                  var status = false;

                  if (data.indexOf(': 1') != -1) {
                	status = true;


                   	if (typeof chrome == 'undefined') {
                		ChromeStorage = require("./chrome-storage").ChromeStorage;
                	}

			        ChromeStorage.setObj({key:key});

                  } else if (data.indexOf(': 0') != -1) {
                	status = false;
                  } else {
                    console.error('ERR: unexpected response in checkKey: data =', data);
                	status = false;
                  }

	   				that.func_send_message(msg, status);

                },
                error: function(jqXHR, textStatus, errorThrown) {
                	console.error(textStatus);
                  	var status = false;
	   				that.func_send_message(msg, status);
                }
              });


            }
            //---------
            if (msg.func == 'setProxy') {
	            that.setProxy(msg.value, function(ret) {
	   				that.func_send_message(msg, ret);
	            });
            }
            //---------
            if (msg.func == 'getRecentProxies') {
	            var recent_proxies = that.getRecentProxies(msg.value);
   				that.func_send_message(msg, recent_proxies);
            }
            //---------
            if (msg.func == 'enableWebRTCLeakPreventing') {
            	that.enableWebRTCLeakPreventing(msg.value);

   				that.func_send_message(msg, 'ok');
            }
            //---------
            if (msg.func == 'preventLeakStateControlledBy') {
            	if (typeof chrome == 'undefined') {

            		var details = {
            			levelOfControl : "controlled_by_this_extension",
            			value : 'disable_non_proxied_udp'
            		};

					var is_enabled = that.prefs_media_peerconnection.getBoolPref("enabled");

					if (is_enabled) {
						details.levelOfControl = '';
					}

	   				that.func_send_message(msg, details);

            	} else {
                	chrome.privacy.network.webRTCIPHandlingPolicy.get({}, function(details) {
	   					that.func_send_message(msg, details);
                  	});
            	}

            }
            //---------
            if (msg.func == 'storage.set') {

            	var obj = msg.value;

				for (var key in obj) {
					that.FF.ss[key] = obj[key];
				}

   				that.func_send_message(msg, []);
            }
            //---------
            if (msg.func == 'storage.get') {

            	var key = msg.value;

            	var ret = {};
            	ret[key] = that.FF.ss[key];

   				that.func_send_message(msg, ret);
            }
            //---------
            if (msg.func == 'storage.remove') {

            	var key = msg.value;

				delete that.FF.ss[key];

   				that.func_send_message(msg, []);
            }
            //---------
            if (msg.func == 'storage.clear') {

				for (var key in that.FF.ss) {
					delete that.FF.ss[key];
				}

   				that.func_send_message(msg, []);
            }
        }

    },

	messages_callbacks : [],

    func_send_message : function(msg, value) {
    	this.port_sendMessage({"doing": 'answer_'+msg.doing, "func" : msg.func, "field" : msg.field, "value" : value});
    },

    func_sendMessage : function(func, field, value, callback) {
    	this.messages_callbacks.push({
    	    "func"		: func,
    		"field" 	: field,
    		"value" 	: value,
    		"callback" 	: callback
    	});

		this.port_sendMessage({"doing": "function", "func" : func, "field" : field, "value" : value});
    },

	port_sendMessage : function(data, port) {
		var that = this;

    	var port_;

    	if (typeof this.FF.panel == 'undefined') {
    	    port_ = port || chrome.extension.connect({name: "hidemyip"});
   	    	port_.postMessage(data, "*");
        } else {
    	    port_ = port || this.FF.panel.port;
    	    port_.emit("message", data);
        }

	},


  addRecent: function(proxy) { // uses Proxy items
    var bFound = false;
    var self = this;
    if (!proxy.list || !this.recent_proxies[proxy.list]) {
      console.error('addRecent: invalid list:', proxy.list);
      return;
    }
    this.recent_proxies[proxy.list].forEach(function(rpr, index) {
      if (rpr.host === proxy.host && rpr.port === proxy.port) {
        bFound = true;
        //unshift -> push, because inversed insert
        self.recent_proxies[proxy.list].push(self.recent_proxies[proxy.list].splice(index, 1)[0]);
      }
    });
    if (!bFound) {
      if (this.recent_proxies[proxy.list].length >= 3)
        this.recent_proxies[proxy.list].pop();
      this.recent_proxies[proxy.list].push(proxy);
    }
  },

  requestProxies: function () {
    var that = this;

    console.log('ProxyManager: requestProxies');

    if (this.timeout) {
      that.timer.clearTimeout(this.timeout);
      this.timeout = null;
    }
    that.DataService.requestProxyList(
    	that.$,
    	that.uniqueid,
        function(data) {
          that._setData(data);
          that.timeout = that.timer.setTimeout(function () {
            that.requestProxies();
          }, 3599950);
        },
        function(error) {
          that._setData([]);
          that._sendErrorNotification(error);
    	}
    )
  },

  trim : function(s) {
    s = s.replace(/^\s+|\s+$/g,'');

  	return s;
  },

  _setData: function (data) { //[_setData]
  	var that = this;


    console.log('ProxyManager: _setData, data.len=', data.length);

    var self = this, activeProxyInList = false, counter1 = 0, counter2 = 0;
    this.proxies = [];

    data.forEach(function (value) {

      //console.log(value);

      //Server: Melbourne,Victoria,AU,AUSTRALIA,5598,80,|103.41.176.38<br />
      if (value.indexOf('Server: ') === 0) {
        var s1 = value.substr(8);
        var tokens = s1.split(',');
        //tokens= ["Sydney 2", "New South Wales", "AU", "AUSTRALIA", "5598", "80", "|163.47.20.184<br />"]
        //console.log('tokens=', tokens);
        var host = tokens[6].replace('\|', '').replace('<br />', '');
        //console.log('host.length ="', host.length);
        //Las Vegas,Nevada  ,US,UNITED STATES,5598,80,|104.143.15.208<br />
        //"Server: Taipei,Taipei  ,TW,TAIWAN,5598,80,|<br />"                 host.length == 0
        var port = parseInt(tokens[4]);
        var countryCode = tokens[2];
        if (countryCode === 'UK') {
          countryCode = 'GB';
        }
        var city = that.trim(tokens[0]);
        var place = that.trim(tokens[1]);
        var country = tokens[3].toLowerCase().replace(/\b[a-z]/g, function(letter) {
          return letter.toUpperCase();
        });
        country = that.trim(country);
        var name = country + ', ';
        if (city !== place && country !== place)
          name += place + ', ' + city;
        else
          name += city;
        //console.log('city=', city);
        //console.log('place=', place);
        //console.log('country=', country);
        //console.log('countryCode=', countryCode);
        //console.log('name=', name);
        //console.log('host="' + host + '"');
        //console.log('port=', port);

        var newProxyItem = new Proxy(host, port, countryCode, name, 'list1');
        self.proxies.push(newProxyItem);
        counter1++;

        //see if active proxy is in the list and if so, replace activeProxy with new object referring to same prox
        if (self.activeProxy && host === self.activeProxy.host && port === self.activeProxy.port) {
          self.activeProxy = newProxyItem;

          //xxx
          var pass = self.activeProxy.pass;
          self.activeProxy.pass = pass;

          self.addRecent(newProxyItem);
          activeProxyInList = true;
        }

      } else if (value.indexOf('ExtraServer: ') === 0) {  // ExtraServer

        var s1 = value.substr(13);
        //console.log('ExtraServer:', s1);
        var tokens = s1.split(',');
        //Roosendaal,North Brabant,NL,Netherlands,128.199.208.93,5278<br />
        //["Roosendaal","North Brabant","NL","Netherlands","128.199.208.93","5278<br />"]
        //Douai,North,FR,France,128.199.208.93,4894<br />
        //["Douai","North","FR","France","128.199.208.93","4894<br />"]
        //Medeiros Neto,Bahia,BR,Brazil,128.199.208.93,4833<br />
        //["Medeiros Neto","Bahia","BR","Brazil","128.199.208.93","4833<br />"]
        //["New York","","US","United States","128.199.208.93","5197<br />"]
        //console.log('tokens=', JSON.stringify(tokens) );
        var host = tokens[4];
        var port = parseInt(tokens[5]);
        var countryCode = tokens[2];
        if (countryCode === 'UK') {
          countryCode = 'GB';
        }
        var city = that.trim(tokens[0]);
        var place = that.trim(tokens[1]);
        var country = tokens[3].toLowerCase().replace(/\b[a-z]/g, function(letter) {
          return letter.toUpperCase();
        });
        country = that.trim(country);
        var name = country + ', ';
        if (city !== place && country !== place && place.length)
          name += place + ', ' + city;
        else
          name += city;

        var newProxyItem = new Proxy(host, port, countryCode, name, 'list2');
        self.proxies.push(newProxyItem);
        counter2++;

        //see if active proxy is in the list and if so, replace activeProxy with new object referring to same prox
        if (self.activeProxy && host === self.activeProxy.host && port === self.activeProxy.port) {
          self.activeProxy = newProxyItem;

          self.addRecent(newProxyItem);
          activeProxyInList = true;
        }
      }// ExtraServer

    });//forEach

    //128.199.208.93:54076 - Tel Aviv, IL           no password
    //Saint-Etienne,Loire,FR,128.199.208.93,39022,
    //var newSocksProxyItem = new Proxy('128.199.208.93', 54076, 'IL', 'socks test');
    //var newSocksProxyItem = new Proxy('128.199.208.93', 39022, 'FR', 'socks test 2');
    //self.proxies.push(newSocksProxyItem);

    console.log('self.proxies.length=', self.proxies.length, 'list1:', counter1, 'list2:', counter2);

    //if active proxy is not in the list, disable it
    if (self.activeProxy && !activeProxyInList) {
      console.log('self.clearProxy()');
      self.clearProxy();
    }

    //send populate proxies message
    this._populate();
  }, //_setData

  _populate: function () {
    console.log('sendMessage populate_proxies');
		this.port_sendMessage({"doing": "populate_proxies"});
  },

  _updateProxies: function () {
		this.port_sendMessage({"doing": "update_proxies"});
  },

  _sendErrorNotification: function (error) {
  	if (!error) {
  		error = {
  			message : "error",
  			code : 0
  		};
  	}

		this.port_sendMessage({"doing": "error", "message" : error.message, "code" : error.code});
  },

  _updateIcon: function () {
  	var that = this;

  	var path, text;

    if (this.activeProxy) {
		var country = this.activeProxy.country;
		path = '/data/img/flags/' + (country === '??' || country === '' ? 'unknown' : country) + '.png';

		text = country;
    }
    else {
		path = '/data/img/disabled.png';
		text = '';
    }

	if (!this.isFF) {
		chrome.browserAction.setIcon({
          path: path
        });

        chrome.browserAction.setBadgeText({
          text: text
        });

	} else {
	    that.browserAction.button.icon = that.FF.data.url(path.substr(6));
	    that.browserAction.button.badge = text;
	}

  },

  getProxies: function () {
  	return this.proxies;
  },

  getRecentProxies: function (list) {
  	console.log(this.recent_proxies);
  	console.log(list);

    if (!list || !this.recent_proxies[list]) {
      console.error('getRecentProxies: invalid list:', list);
      return;
    }
    return this.recent_proxies[list];
  },


	//http://stackoverflow.com/questions/23822170/getting-unique-clientid-from-chrome-extension
	getRandomToken : function () {
  		// E.g. 8 * 32 = 256 bits token

		var _rnds;

  		if (typeof crypto == 'undefined') {
			_rnds = new Array(16);

            for (var i = 0, r; i < 16; i++) {
              if ((i & 0x03) === 0) { r = Math.random() * 0x100000000; }
              _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
            }

  		} else {
          	_rnds = new Uint8Array(32);
          	crypto.getRandomValues(_rnds);
  		}

      	var hex = '';
      	for (var i = 0; i < _rnds.length; ++i) {
        	hex += _rnds[i].toString(16);
      	}
  		// E.g. db18458e2782b2b77e36769c569e263a53885a9944dd0a861e5064eac16f1a

  		return hex;
	},

    enableWebRTCLeakPreventing : function (bEnable) {
      	var that = this;

      	console.log('enableWebRTCLeakPreventing, setting to:', bEnable);

		if (typeof chrome == 'undefined') {

			that.prefs_media_peerconnection.setBoolPref("enabled", bEnable);


      } else {
          var newVal = chrome.privacy.IPHandlingPolicy.DEFAULT;
          if (bEnable) {
            newVal = chrome.privacy.IPHandlingPolicy.DISABLE_NON_PROXIED_UDP;
          }

          chrome.privacy.network.webRTCIPHandlingPolicy.get({}, function(details) {

                console.log('webRTCIPHandlingPolicy details:', details);

                if (details.levelOfControl !== 'controlled_by_this_extension' &&
                    details.levelOfControl !== 'controllable_by_this_extension' )
                {
                  console.log("webRTCIPHandlingPolicy controlled_by_other_extensions");
                  //controlled_by_other_extensions
                } else {
                  //details: Object {levelOfControl: "controlled_by_other_extensions", value: "disable_non_proxied_udp"}
                  chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: newVal }, function() {
                    if (chrome.runtime.lastError === undefined) {
                      that.timer.setTimeout( function() {
                        chrome.privacy.network.webRTCIPHandlingPolicy.get({}, function(details_again) {
                          console.log('webRTCIPHandlingPolicy details_again:', details_again);
                          if (details_again.value == newVal) {
                            console.log("webRTCIPHandlingPolicy.set() successful, new value:", newVal);
                          } else {
                            console.log("webRTCIPHandlingPolicy.set() NOT CHANGED");
                          }
                        });
                      }, 300);
                    } else {
                      console.log("webRTCIPHandlingPolicy.set() error:", chrome.runtime.lastError);
                    }
                  });
                }
          });
      }




    },

    flagExists : function (code, cb) {
      //flagExists('AD', function(bRes) {console.log(bRes)})

      var path = 'data/img/flags/' + code + '.png';

      function fileExists(rootEntry, filename, callback) {
        rootEntry.getFile(filename, {
          create: false
        }, function() {
          callback(true);
        }, function() {
          callback(false);
        });
      }
      chrome.runtime.getPackageDirectoryEntry(function(root) {
        fileExists(root, path, cb);
      });
    },


  	setProxy: function (proxy, cb) {
      	var that = this;
        var self = this;

        console.log('ProxyManager setProxy');

        that.DataService.registerIP(
	    	that.$,
        	that.uniqueid,
        	proxy.host,

            function(type, data) {
              	console.log('registerIP data=', data, 'type[ 1 (usual), 2 (socks5) ]=', type);

              	if (type === 1) {
              		proxy.pass = data;
              	}

              	self.activeProxy = proxy;
              	self.addRecent(proxy);

              	self._updateIcon();
              	self._updateProxies();
              	that.Storage.saveProxy(proxy);

              	that.ProxyAdapter.setProxy(proxy.host, proxy.port, type, proxy.pass);

              	cb({status:'success'});
            },

            function(err) {
              	console.error('registerIP err=', err);

  	        	that.clearProxy();

              	cb({status:'error'});
            }
    	);
  	},

	clearProxy: function () {
      	var that = this;

        that.ProxyAdapter.removeProxy();

        this.activeProxy = null;
        this._updateIcon();
        this._updateProxies();
        that.Storage.saveProxy();
  	}
};


//asyncBlocking:
//If an event listener is registered with "asyncBlocking" listed in the extraInfoSpec,
//then a callback is passed into the listener in addition to the details argument.
//The callback expects a BlockingResponse argument, and MUST be invoked by the listener
//at some point so the request can proceed.
//This is supported for the onAuthRequired listener only at this point.




var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-48046477-1']);
_gaq.push(['_trackPageview']);


function ajax_pr(url) { // ajax promise, only HEAD - just to check if the url exists
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      resolve(this);
    };
    xhr.onerror = reject;
    xhr.open('HEAD', url);
    xhr.send();
  });
}








if (typeof chrome != 'undefined') {
    ProxyManager.init();
}


if (typeof exports != 'undefined') {
    exports.init = function() {
    	return ProxyManager;
    };
}
