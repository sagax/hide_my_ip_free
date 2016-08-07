if (typeof funcs == 'undefined') {
	var funcs = {};
}

if (typeof exports != 'undefined') {
	funcs = exports;
} else {
	funcs = window;
}

if(!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g,'');
  };
}

//-----------------
funcs.port_sendMessage = function(data, port) {
	var port_;
	if (typeof chrome.runtime.connect != 'undefined') {
		// Chrome
	    port_ = port || chrome.runtime.connect({name: "hidemyip"});
    	port_.postMessage(data, "*");
    } else {
        // Firefox
	    port_ = port || addon.port;
	    port_.emit("message", data);
    }
};


funcs.get_el_by_fields = function(arr, fv) {
    var j, k, l;
    for (var i=0, m = arr.length; i < m; i++)
    {
     if (typeof arr[i] != 'undefined')
     {
      k=0, l=0;
      for (j in fv) if (fv.hasOwnProperty(j))
      {
       l++;
       if (typeof arr[i][j] != 'undefined')
       {
        if (arr[i][j] == fv[j]) k++;
       }
      }
      if (l > 0 && k == l) return i;
     }
    }
    return -1;
};

funcs.get_els_by_field = function(arr, f, v) {
        var els = [];
        for (var i=0, m = arr.length; i < m; i++)
        {
         if (arr[i][f] == v)
         {
          els.push(i);
         }
        }
        return els;
};
//===========================================
var Dump = function(d, l, t) {
   if (typeof(t) == "undefined") t = "\n";

   var space = (t == "\n")?' ':'&nbsp;';

   if (l == null) l = 1;
   var s = '';

   if (typeof(d) == "object") {
        s += typeof(d) + space+"{"+t;
        for (var k in d) {
            if (typeof(d[k]) != "function"){
             for (var i=0; i<l; i++) s += space+space;
             s += k+":"+space + Dump(d[k],l+1, t);
            }
        }
        for (var i=0; i<l-1; i++) s += space+space;
        s += "}"+t;
    } else if (typeof(d) != "function"){
        s += "" + d + t;
    } else if (typeof(d) == "function"){
        s += "" + d.toString() + t;
    }
    return s;
};

funcs.mprint = function(s) {
	//if (!window.nnrucommcore.DEBUG) return;

    if (typeof opera != 'undefined') {
        window.opera.postError(Dump(s, 1));
    } else {
	    console.log(Dump(s, 1));
    }
};
