var DataService = {

  requestProxyList: function($, uniqueid, successCb, errorCb) {
  	if (typeof SyncStorage == 'undefined') {
		SyncStorage = require("./chrome-storage").SyncStorage;
  	}

    console.log('DataService.requestProxyList, uniqueid =', uniqueid);
    var url = 'https://api.hide-my-ip.com/chrome.cgi?uniqueid=' + uniqueid;
    SyncStorage.getKey(function(k) {
      if (k) {
        url += '&key=' + k;
      }

      $.ajax({
        method: 'GET',
        url: url,
        success: function (data) { successCb(data.split('\n')) },
        error: function(jqXHR, textStatus, errorThrown) { errorCb(textStatus); }
      });

    });
  },

  registerIP: function ($, uniqueid, ip, successCb, errorCb) {
  	if (typeof SyncStorage == 'undefined') {
		SyncStorage = require("./chrome-storage").SyncStorage;
  	}

    var url = 'https://api.hide-my-ip.com/chrome.cgi?ip=' + ip + '&uniqueid=' + uniqueid;
    console.log('DataService registerIP, url=', url);
    SyncStorage.getKey(function(k) {
      if (k) {
        url += '&key=' + k;
      }

      $.ajax({
        method: 'GET',
        url: url,
        success: function (data) {
          console.log('response len:', data.length)
          console.log(data)

          if (data.length == 32 )
            successCb(1, data);//type, data
          else if (data.length == 3 && data.substr(0, 2) === '-1')
            successCb(2);
          else
            errorCb('registerIP: wrong response from server:', data);
        },
        error: function(jqXHR, textStatus, errorThrown) { errorCb(textStatus); }
      });

    });
  }
}


if (typeof exports != 'undefined') {
    exports.DataService = DataService;
}
