//4466b578b59fe15f1ac45d0c6d9014cd

$(function() {
  var main = new Main();
});

var Main = function() {
  var that = this;
  this.isFF = typeof chrome.runtime.onConnect == 'undefined';

  if (!this.isFF) {
    chrome.runtime.onConnect.addListener(function(port) {
      if (port.name == 'hidemyip') {
        port.onMessage.addListener(function(msg) {
          that.msg_handler(msg);
        });
      }
    });
  } else {
    addon.port.on("message", function(message) {
      that.msg_handler(message);
    });
  }

  port_sendMessage({doing: "popup_ignition"});
};

Main.prototype = {
  menuItems: [],

  messages_callbacks: [],

  msg_handler: function(msg) {
    var that = this;

    if (msg.doing == 'ignition_ok') {
      that.init(msg.coreInfo);
    }

    if (msg.doing == 'populate_proxies') {
      that.populateProxyList();
    }

    if (msg.doing == 'update_proxies') {
      that.updateMenuItems();
    }

    if (msg.doing == 'error') {
      that.setStatusMessage(msg.message, true);
      // in case of any error disable proxy
      that.clearProxy();
    }

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
  },

  clearProxy: function() {
    port_sendMessage({doing: "clearProxy"});
    this.ProxyManager.activeProxy = null;
  },

  func_sendMessage: function(msg, field, value, callback) {
    this.messages_callbacks.push({
      "func": msg,
      "field": field,
      "callback": callback
    });

    port_sendMessage({"doing": "function", "func": msg, "field": field, "value": value});
  },

  init: function(coreInfo) {
    var that = this;

    that.func_sendMessage('init', 'some_options', '', function(ProxyManager) {
      that.ignition(ProxyManager);
    });
  },

  ignition: function(ProxyManager) {
    var that = this;

    that.ProxyManager = ProxyManager;

    that.isActivated = false;
    if (that.ProxyManager.key) {
      that.isActivated = true;
    }

    that.proxyListContainer = $('#proxy-list');//.hide();
    that.enterCodeContainer = $('#enter-code-div').hide();

    that.separatorElement = $('#separator').hide();
    that.statusMessage = $('#status-message').hide();
    that.loader = $('#loader');

    that.anim_duration = 100;
    that._tooltip_delay = 500;

    that.lastClickTime = 0;
    that.msgTimerId = null;
    that.returnBackTimerId = null;
    that._tooltipsterObjects = null;

    that._tooltipTimerDelayId = null;

    // for testing UI, to be able quickly refresh popup without making request to the server
    that.bLocalTest = false;//true;//

    //var isMainScreen = true  // false after Enter Code button clicked

    that.btn_more_Pointer = false;
    that.btn_enter_Pointer = false;

    console.log('popup, ProxyManager.activeProxy=', ProxyManager.activeProxy);

    //[enter code page]

    $('#textarea_key').attr('placeholder', that.ProxyManager.i18n['textarea_placeholder']);

    function returnBack () {
      if (that.returnBackTimerId) {
        clearTimeout(that.returnBackTimerId);
        that.returnBackTimerId = null;
      }
      //if (isMainScreen)
      //return;
      //isMainScreen = true;

      //return to default page
      that.enterCodeContainer.transition({
        rotateY: '+=90deg',
        duration: that.anim_duration,
        easing: 'in',
        complete: function() {
          that.enterCodeContainer.hide();
          //that.proxyListContainer.transition({rotateY: '90deg', duration: 0});
          that.proxyListContainer.show();
          that.proxyListContainer.transition({rotateY: '-=90deg', duration: that.anim_duration, easing: 'in'});

          that.statusMessage.hide();
          $("#btn_enterCode").removeClass('disabled');
        }
      });
    }

    $('#btn_back')
      /*
         .hover(
         function() {
         $(this).css({ 'text-shadow': '0 0 1px #fff',
         'background-color': '#3cb0fd',
         'background-image': '-webkit-linear-gradient(top, #3cb0fd, #3498db)' })
         },
         function() {
         $(this).css({ 'text-shadow': 'none',
         'background-color': '#3498db',
         'background-image': '-webkit-linear-gradient(top, #3498db, #2980b9)' })
         }
         )*/
      .on('click', function (e) {
        if (!$(this).hasClass('disabled')) {
          returnBack();
        }
      })
    .find('span').text(that.ProxyManager.i18n['btn_back']);//btn_back

    $('#btn_enterCode')
      .on('click', function (e) {
        if (!$(this).hasClass('disabled')) {
          $("#btn_enterCode").addClass('disabled');
          $("#btn_back").addClass('disabled');
          $('#textarea_key').attr('readonly','readonly').addClass('readonly_enabled');
          $("#btn_enterCode i").transition({rotate: '+=360deg', duration: 1000, easing: 'linear'});
          var intervalID = setInterval(function() {
            $("#btn_enterCode i").transition({rotate: '+=360deg', duration: 1000, easing: 'linear'});
          }, 1010);

          that.checkKey($('#textarea_key').val(), function(bResult) {
            $("#btn_enterCode").removeClass('disabled');
            $("#btn_back").removeClass('disabled');
            $('#textarea_key').removeAttr('readonly').removeClass('readonly_enabled');
            clearInterval(intervalID);
            if (bResult) {
              $("#btn_enterCode").addClass('disabled');
              $('#textarea_key').addClass('key_valid').removeClass('key_invalid');


              that.setStatusMessage(that.ProxyManager.i18n['success_key_msg'], false);

              that.isActivated = true;

              that.btn_more_Pointer.html(that.ProxyManager.i18n['btn_more']);
              that.btn_enter_Pointer.html(that.ProxyManager.i18n['btn_change']);
              //setTimeout(returnBack, 2500)
              if (that.returnBackTimerId) {
                clearTimeout(that.returnBackTimerId);
                that.returnBackTimerId = null;
              }
              that.returnBackTimerId = setTimeout(function() {
                returnBack();

                port_sendMessage({doing: "requestProxies"});


              }, 3000);
            } else {
              $('#textarea_key').addClass('key_invalid').removeClass('key_valid');
              that.setStatusMessage(that.ProxyManager.i18n['invalid_key_msg'], true);
            }
          });
        }
      })
    .find('span').text(that.ProxyManager.i18n['btn_enter_license_key']);//btn_enterCode

    if (that.isActivated){
      $('#btn_enterCode').find('span').text(that.ProxyManager.i18n['btn_enter_license_key']);
    }

    //if (bLocalTest) {
    //return //testing enter key
    //}

    if (that.bLocalTest) {
      ChromeStorage.get('proxies')
        .then(
            function(val) {
              if (val === undefined) { // no saved proxies
                console.log('no saved proxies');
              } else {
                that.populateProxyList();
                that.updateMenuItems();
                return;
              }
            }
            );
    }

    if (ProxyManager.activeProxy) {
      that.populateProxyList();
      that.updateMenuItems();
    } else {
      that.clearProxy();
      that.proxyListContainer.empty();
      that.proxyListContainer.hide();
      that.loader.show();
      if (that.bLocalTest) {
        ChromeStorage.get('proxies').then(
            function(val) {
              if (val === undefined) { // no saved proxies
                console.log('no saved proxies');
                port_sendMessage({doing: "requestProxies"});
              }
            });
      } else {
        port_sendMessage({doing: "requestProxies"});
      }
    }
  },

  populateProxyList: function () { //[populateProxyList]
    var that = this;

    console.log('populateProxyList');

    //ChromeStorage.get('some_options').then( function(val) { console.log(val); })

    ChromeStorage.get('some_options').then( function(some_options_val) {
      if (some_options_val === undefined) { // no saved some_options
        var def_opt = {cur_list:'list1', bPreventLeak:true};
        that.preventLeakStateControlledBy(function(bThisExtsn) {
          ChromeStorage.setObjExt('some_options', def_opt);
        });
        some_options_val = def_opt;
      } else {
        if (some_options_val.bPreventLeak === undefined) { // cur_list exists, but bPreventLeak not
          // init default
          some_options_val.bPreventLeak = true;
          ChromeStorage.setObjExt('some_options', {bPreventLeak:true});
        }
      }
      console.log('populateProxyList, some_options_val =', some_options_val);

      if (!that.bLocalTest) { // from server
        that.func_sendMessage('getProxies', 'getProxies', '', function(proxies) {
          that.onProxiesReady(that.ProxyManager, proxies, some_options_val);
        });
      } else { // from storage
        console.log('ChromeStorage.get proxies');
        ChromeStorage.get('proxies').then(
            function(val) {
              if (val === undefined) { // no saved proxies
                that.func_sendMessage('getProxies', 'getProxies', '', function(proxies) {
                  console.log('ChromeStorage.setObj(proxies), len:', proxies.length);
                  var someproxies = proxies.slice(0, 50);
                  //console.log(someproxies, typeof someproxies, typeof someproxies[0]);
                  var counter = 50;
                  someproxies.forEach(function(prxy) {
                    if (counter-- % 2 === 0)
                      prxy.list = 'list1';
                    else
                      prxy.list = 'list2';
                    delete prxy.isActive;
                    delete prxy.manager;
                    delete prxy.toggle;
                  });
                  ChromeStorage.setObj({proxies:someproxies}).then(function() {
                    that.onProxiesReady(that.ProxyManager, someproxies, some_options_val);
                  });
                });
              } else { // from storage saved proxies
                //console.log('that.bLocalTest> in populateProxyList ChromeStorage.get(proxies), val:', val, val.length);
                val.forEach(function (proxy) {
                  proxy.isActive = function() { return false; };
                  proxy.toggle = function() { };
                });
                that.onProxiesReady(that.ProxyManager, val, some_options_val);
              }
            },
        function(err) {
          console.error(err);
        }
        );
      }// if that.bLocalTest
    },
    function(err) {
      console.error(err);
    }
    );
  },

  // some_options - list1 or list2, bPreventLeak
  onProxiesReady: function (ProxyManager, proxies, some_options) {
    var that = this;

    console.log('onProxiesReady, some_options:', some_options);
    that.proxyListContainer.empty();
    var curList = some_options.cur_list;

    if (!curList) {
      curList = 'list1';
    }

    if (!that.bLocalTest) {
      proxies.sort(function sortFunction(a, b) {
        if(a.name < b.name)
          return -1;
        if(a.name > b.name)
          return  1;
        return 0;
      });
    }

    //empty current proxy list
    that.proxyListContainer.empty();
    that.menuItems = [];

    if (proxies.length) {
      //console.log(recent_proxies);

      that.func_sendMessage('getRecentProxies', '', curList, function(recent_proxies) {
        that.proxyListContainer.empty();

        if (recent_proxies.length) {
          recent_proxies.forEach(function(proxy) {
            that.menuItems.push(new that.MenuItem(that, proxy, that.proxyListContainer, 'prepend'));
          });

          $('<div>').addClass('badger1').text(that.ProxyManager.i18n['badger1']).prependTo(that.proxyListContainer);
        }

        $('<div>').addClass('badger2').text(that.ProxyManager.i18n['badger2']).appendTo(that.proxyListContainer);

        var bDisableSecondList = true;

        proxies.forEach(function(proxy) {
          if (proxy.list === curList)
            that.menuItems.push(new that.MenuItem(that, proxy, that.proxyListContainer));
          if (proxy.list === 'list2')
            bDisableSecondList = false;
        });

        //select list

        var divSelectList = $('<div id="select-locations-list">').addClass('select-list-radio');
        $('<input type="radio" id="radio1" name="select-locations" value="list1" ' +
            (curList === 'list1' ? 'checked="checked">' : '>') ).appendTo(divSelectList);
        $('<label for="radio1"' + (curList === 'list1' ? ' class="selected-label">' : '>') +
            'Hide My IP Network</label>').appendTo(divSelectList);
        $('<input type="radio" id="radio2" name="select-locations" value="list2" ' +
            (curList === 'list2' ? 'checked="checked">' : '>') ).appendTo(divSelectList);
        $('<label for="radio2"' + (curList === 'list2' ? ' class="selected-label">' : '>') +
            'Floating IP Network</label>').appendTo(divSelectList);
        divSelectList.appendTo(that.proxyListContainer);
        // No items in Floating IP List -> disable that radio button
        if (bDisableSecondList) {
          $('#radio2').attr('disabled', 'disabled');
        }
        $('input[type=radio][name=select-locations]').on('change', function() {  // on radio button change
          $('input[type=radio][name=select-locations]').attr('disabled', 'disabled');
          var selected_lst = $(this).val();
          if (ProxyManager.activeProxy) {
            if (ProxyManager.activeProxy.list == selected_lst)
              ChromeStorage.setObjExt('some_options', {cur_list:selected_lst});
          } else {
            ChromeStorage.setObjExt('some_options', {cur_list:selected_lst});
          }
          setTimeout(function() {
            that.onProxiesReady(ProxyManager, proxies, {cur_list: selected_lst });
            document.getElementById('proxy-list').scrollTop = 10000;
          }, 300);
        });

        //[PreventLeak checkbox]

        var divPreventLeakDiv = $('<div id="checkbox-prevent-leak">').addClass('preventleak');
        $('<input type="checkbox" id="checkbox1" name="preventleak">' ).appendTo(divPreventLeakDiv);
        $('<label for="checkbox1">Prevent WebRTC IP Leak</label>').appendTo(divPreventLeakDiv);
        divPreventLeakDiv.appendTo(that.proxyListContainer);

        //[tooltipster1] http://iamceege.github.io/tooltipster/
        $('div#checkbox-prevent-leak').tooltipster({
          theme: 'tooltipster-light',
          content: 'To prevent IP address leak while using a proxy, WebRTC should use the same network path for media as for normal web traffic. If the checkmark is set, it means the correct WebRTC mode is set or will be automatically set before you enable a proxy and if the extension has control over WebRTC mode.' +
            //'<hr />When <strong>there is no checkmark</strong>, WebRTC will explore all network paths to find the best way to send and receive media. Websites can detect your real IP address.' +
            '<hr />If the checkbox is disabled, it means some other extension controls WebRTC mode. '
            ,
          //content: 'This option shows the state of the WebRTC mode (WebRTC leak). <hr />' +
          //         '<strong>No checkmark:</strong> Chrome will explore all network paths to find the best way to send and receive media. Websites can detect your real IP address.<hr />' +
          //         '<strong>Checkmark presented:</strong> Chrome uses the same network path for media as for normal web traffic, including use of a proxy. Enabling this mode prevents the leak.'
          //         ,
          contentAsHTML: true,
          minWidth: 250,
          maxWidth: 250,
          hideOnClick: true,
          position: 'top-right',
          offsetX: -10,
          animation: 'fall',
          updateAnimation: false,
          speed: 100,
          delay: 100,
          trigger: 'custom'
        });

        if (!that._tooltipsterObjects) { //[tooltipster2]
          that._tooltipsterObjects = $('div#checkbox-prevent-leak').tooltipster({
            theme: 'tooltipster-light',
            contentAsHTML: true,
            minWidth: 280,
            maxWidth: 280,
            multiple: true,
            hideOnClick: true,
            animation: 'slide',
            speed: 100,
            updateAnimation: false,
            delay: that._tooltip_delay,
            trigger: 'hover'
          })[0];
        }

        that.preventLeakStateControlledBy(function(bThisExtsn, value, reason) {
          if (bThisExtsn) {
            $('input[type=checkbox][name=preventleak]').attr('disabled', false);
            $('input[type=checkbox][name=preventleak]').prop('checked', some_options.bPreventLeak);
          } else { // not controlled
            var bLeakPreventingStillWorks = (value === 'disable_non_proxied_udp');
            $('input[type=checkbox][name=preventleak]').attr('disabled', 'disabled');
            $('input[type=checkbox][name=preventleak]').prop('checked', bLeakPreventingStillWorks);
            if (that._tooltipsterObjects) {
              var str = (reason == 'controlled_by_other_extensions') ?
                'The extension can\'t controll this option, reason: <strong>' + reason +
                '</strong>.' +
                ( bLeakPreventingStillWorks ?
                  '<hr />But the current WebRTC mode still prevents the leak.' : '' ) +
                '<hr /><i>If you want WebRTC policy auto switched on and off by this extension, disable other extensions which can control WebRTC mode.</i>'
                : 'Can\'t change the settings, reason: <strong>' + reason + '</strong>.'
                that._tooltipsterObjects.content(str);
              if (bLeakPreventingStillWorks)
                that._tooltipsterObjects.option('theme', 'tooltipster-light');
              else
                that._tooltipsterObjects.option('theme', 'tooltipster-error');
            }
          }
        });

        var bWholeLabelHover = false;
        $('input[type="checkbox"] + label')
          .hover(
              function() {
                console.log('h in');
                bWholeLabelHover = true;
              },
              function() {
                console.log('h out');
                bWholeLabelHover = false;
                $('div#checkbox-prevent-leak').tooltipster('hide');
                if (that._tooltipTimerDelayId) {
                  clearTimeout(that._tooltipTimerDelayId);
                  that._tooltipTimerDelayId = null;
                }
                if (that._tooltipsterObjects)
                  that._tooltipsterObjects.hide();
              }
              );

        var label_width = parseInt(window.getComputedStyle(document.querySelector('input[type=checkbox][name=preventleak] + label').parentNode).width, 10);
        var marker_width = parseInt((window.getComputedStyle(document.querySelector('input[type=checkbox][name=preventleak] + label'), ':after')).width, 10);
        var some_offset = 7;

        $('input[type=checkbox][name=preventleak] + label').on('mousemove', function(event) {
          if (that._tooltipTimerDelayId) {
            clearTimeout(that._tooltipTimerDelayId);
            that._tooltipTimerDelayId = null;
          }

          if ( event.offsetX > (label_width - marker_width - some_offset ) &&
              event.offsetX < (label_width - some_offset) &&
              bWholeLabelHover ) {
            if (that._tooltipsterObjects)
              that._tooltipsterObjects.hide();
            //console.log('mousemove:', event.offsetX, marker_width, label_width);
            that._tooltipTimerDelayId = setTimeout(function() {
              $('div#checkbox-prevent-leak').tooltipster('show');
            }, that._tooltip_delay);

          } else if (bWholeLabelHover && event.offsetX < (label_width - marker_width - some_offset)) {
            if ($('input[type=checkbox][name=preventleak]').attr('disabled') !== 'disabled') {
              $('div#checkbox-prevent-leak').tooltipster('hide');
              that._tooltipTimerDelayId = setTimeout(function() {
                if (that._tooltipsterObjects) {
                  that._tooltipsterObjects.content( that.getTooltipContent(some_options.bPreventLeak)).show();
                }
              }, that._tooltip_delay);
            }
          } else {
            $('div#checkbox-prevent-leak').tooltipster('hide');
          }
        });

        //[checkbox on change]
        $('input[type=checkbox][name=preventleak]').on('change', function() {
          //$('input[type=checkbox][name=preventleak]').attr('disabled', 'disabled');

          if (ProxyManager.activeProxy) {
            console.log('ProxyManager.activeProxy');

            $('input[type=checkbox][name=preventleak]').prop('checked', some_options.bPreventLeak);
            that.setStatusMessage('Can\'t switch the mode while using a proxy.', true);

            /*
               if (that._tooltipTimerDelayId) {
               clearTimeout(that._tooltipTimerDelayId);
               that._tooltipTimerDelayId = null;
               }
               that._tooltipTimerDelayId = setTimeout(function() {
               if (that._tooltipsterObjects) {
               that._tooltipsterObjects.content('Can\'t switch the mode while using a proxy.').show();
               } else {
               console.log('_tooltipsterObjects:', that._tooltipsterObjects);
               }
               }, that._tooltip_delay);
               */

          } else {
            var bVal = $(this).is(':checked');
            console.log('setting checkbox to:', bVal);
            that.preventLeakStateControlledBy(function(bThisExtsn, value) {
              if (bThisExtsn) {
                some_options.bPreventLeak = bVal;
                ChromeStorage.setObjExt('some_options', {bPreventLeak:bVal});
                // this will be made automatically
                //_bg.enableWebRTCLeakPreventing(bVal);
                that._tooltipsterObjects.content(
                    that.getTooltipContent(some_options.bPreventLeak)
                    ).show();
              }
            });
            setTimeout(function() {
              that.preventLeakStateControlledBy(function(bThisExtsn, value) {
                if (bThisExtsn) {
                  //that._tooltipsterObjects.content(
                  //  that.getTooltipContent(value === 'disable_non_proxied_udp')
                  //).show();
                } else {
                  $('input[type=checkbox][name=preventleak]').prop('checked',
                      (value === 'disable_non_proxied_udp')
                      );
                }
              });
            }, 300);
          }
        });

        //more locations

        var parent_more = $('<div>').addClass('parent_more').appendTo(that.proxyListContainer)
          .hover(
              function() { // mouse in
                btn_more.hide();
                btn_enter.show();
                btn_enter.transition({
                  x: '40px',
                  duration: that.anim_duration,
                  easing: 'in'
                });
                btn_buy.show();
                btn_buy.transition({
                  x: '-40px',
                  duration: that.anim_duration,
                  easing: 'in'
                });
              },
              function() { // mouse out
                btn_enter.transition({
                  x: '-40px',
                  duration: that.anim_duration,
                  easing: 'in',
                  complete: function() {
                    btn_enter.hide();
                    if (!btn_more.is(":visible") && !parent_more.is(":hover"))
                      btn_more.show();
                    if (parent_more.is(":hover")) {
                      if (!btn_enter.is(":visible"))
                        btn_enter.show();
                      if (!btn_buy.is(":visible"))
                        btn_buy.show();
                    }
                  }
                });
                btn_buy.transition({
                  x: '40px',
                  duration: that.anim_duration,
                  easing: 'in',
                  complete: function() {
                    btn_buy.hide();
                    if (!btn_more.is(":visible") && !parent_more.is(":hover"))
                      btn_more.show();
                    if (parent_more.is(":hover")) {
                      if (!btn_enter.is(":visible"))
                        btn_enter.show();
                      if (!btn_buy.is(":visible"))
                        btn_buy.show();
                    }
                  }
                });
              }
        )
          .on('mousemove', function (e) {
            if (parent_more.is(":hover")) {
              if (!btn_enter.is(":visible"))
                btn_enter.show();
              if (!btn_buy.is(":visible"))
                btn_buy.show();
            }
          });

        var btn_buy = $('<div>')
          .addClass('btn_buy')
          .html(that.ProxyManager.i18n['btn_buy'])
          .hide()
          .appendTo(parent_more)
          .on('click', function (e) {
            if (Date.now() - that.lastClickTime > 100 && e.button === 0) {
              that.lastClickTime = Date.now();

              var purl = 'https://www.hide-my-ip.com/order.shtml?product=905';
              if (!that.isFF) {
                chrome.tabs.create({ url: purl });
              } else {
                window.open(purl);
              }
            }
          });

        var btn_enter = $('<div>')
          .addClass('btn_enter')
          .html(that.ProxyManager.i18n['btn_enter'])
          .hide()
          .appendTo(parent_more)
          .on('click', function (e) {
            //isMainScreen = false

            that.statusMessage.hide();

            SyncStorage.getKey(function(k) {
              $('#textarea_key')
                .removeClass('key_invalid')
                .removeClass('key_valid');

              if (k) {
                $('#textarea_key').val(k);
              }

            });
            that.proxyListContainer.transition({
              //y: '100px',
              //rotateY: '180deg',
              //perspective: '100px',
              //rotateY: bProxyListContainerRotated? '-180deg' : '180deg',
              //rotateY: bProxyListContainerRotated? '-=90deg' : '+=90deg',
              rotateY: '+=90deg',
              duration: that.anim_duration,
              easing: 'in',
              complete: function() {
                that.proxyListContainer.hide();
                that.enterCodeContainer.transition({rotateY: '90deg', duration: 0});
                that.enterCodeContainer.show();
                that.enterCodeContainer.transition({rotateY: '-=90deg', duration: that.anim_durationg, easing: 'in'});
                $('#textarea_key').focus();
              }
            });
          });//btn_enter

        if (that.isActivated) {
          btn_enter.html(that.ProxyManager.i18n['btn_change']);
        }

        that.btn_enter_Pointer = btn_enter;

        var btn_more = $('<div>').addClass('btn_more').text(that.ProxyManager.i18n['btn_more_locations'])
          .appendTo(parent_more);

        if (that.isActivated) {
          btn_more.html(that.ProxyManager.i18n['btn_more']);
        }

        that.btn_more_Pointer = btn_more;
        that.proxyListContainer.show();
      });
    } else {
      that.proxyListContainer.hide();
      that.separatorElement.hide();
    }

    that.loader.hide();
    if (that.bLocalTest) {
      document.getElementById('proxy-list').scrollTop = 10000;
      //that.setStatusMessage('', false);
    }
  },

  updateMenuItems: function () {
    var that = this;
    that.menuItems.forEach(function (menuItem) {
      menuItem.update();
    });
  },

  preventLeakStateControlledBy: function (cb) { //[preventLeakStateControlledBy]
    var that = this;

    that.func_sendMessage('preventLeakStateControlledBy', '', '', function(details) {
      console.log('webRTCIPHandlingPolicy details:', details);
      //https://developer.chrome.com/extensions/types#type-LevelOfControl
      //https://developer.chrome.com/extensions/privacy
      //https://www.google.com/intl/en/chrome/browser/privacy/whitepaper.html
      if (details.levelOfControl == 'controlled_by_this_extension' ||
          details.levelOfControl == 'controllable_by_this_extension') {
        cb(true, details.value);
      } else {
        cb(false, details.value, details.levelOfControl);
      }
    });
  },

  // tooltips for checkbox
  getTooltipContent: function (bPolicySwitchingEnabled) {
    var that = this;

    return bPolicySwitchingEnabled
      ?
      'WebRTC mode is controlled by this extension and <strong>will be switched</strong> before using a proxy from the list.' +
      '<hr/><i>To prevent IP address leaking the extension will set the "disable non-proxied UDP" WebRTC mode just before enabling a proxy. This option forces Chrome to send media through the proxy. This will hurt WebRTC performance and increase the load on the proxy, but prevents IP address leaking. ' +
      'After the proxy is disabled, the extension restores default WebRTC mode. </i>'
      :
      'WebRTC mode is controlled by this extension, but <strong>will NOT be switched</strong> before using a proxy from the list.' +
      '<hr/><i>To provide the best WebRTC experience Chrome will explore all network paths to find the best way to send and receive media. But websites can detect your real IP address.</i>' +
      '<hr/><i>Set the checkmark to prevent WebRTC IP address leaking.</i>'
      ;
  },

  setStatusMessage: function (message, isError, noOops) {
    var that = this;

    //that.statusMessage.show();
    if (that.msgTimerId)
      clearTimeout(that.msgTimerId);
    that.msgTimerId = setTimeout(function() {
      that.msgTimerId = null;
      that.statusMessage.hide();
    }, 5000);

    if (isError) {
      that.statusMessage.show();
      //that.separatorElement.show();
      if (noOops) {
        that.statusMessage.html(message);
      } else {
        that.statusMessage.html('<strong>'+that.ProxyManager.i18n['oops_msg']+'</strong> '+message);
      }
      that.statusMessage.addClass('error');
    }
    else {
      that.statusMessage.show();
      that.separatorElement.hide();
      that.statusMessage.html('<strong>'+that.ProxyManager.i18n['success_msg']+'</strong><br/>'+message);
      that.statusMessage.removeClass('error');
    }
  },

  // method: undefined | 'prepend'
  MenuItem: function (that, proxy, parent, method) {
    proxy.isActive = function () {
      return that.ProxyManager.activeProxy && that.ProxyManager.activeProxy.host === proxy.host && that.ProxyManager.activeProxy.port === proxy.port;
    };

    proxy.toggle = function (cb) {
      if (typeof chrome == 'undefined') {
        ChromeStorage = require("chrome-storage").ChromeStorage;
      }

      console.log('Proxy: toggle');

      ChromeStorage.get('some_options').then( function(some_options_val) {
        console.log('Proxy: toggle, some_options_val:', some_options_val);

        if (proxy.isActive()) {
          that.clearProxy();
          cb({status:'success disconnect'});
          if (some_options_val && some_options_val.bPreventLeak) {
            that.func_sendMessage('enableWebRTCLeakPreventing', '', false, function() {
            });
          }
        } else {
          if (some_options_val && some_options_val.bPreventLeak) {
            that.func_sendMessage('enableWebRTCLeakPreventing', '', true, function() {
            });
          }
          that.func_sendMessage('setProxy', 'setProxy', proxy, function(ret) {
            if (ret['status'] == 'success') {
              that.ProxyManager.activeProxy = proxy;
            }
            cb(ret);
          });
        }
      });
    };

    var container = that.createMenuItemDOMEl(proxy);

    //bind click event to toggle proxy
    container.on('click', function (e) {                         //[on menu item click]
      if (Date.now() - that.lastClickTime > 100 && e.button === 0) {
        that.lastClickTime = Date.now();
        if (proxy.host.length === 0) {
          that.setStatusMessage(that.ProxyManager.i18n['please_upgrade_msg'], true, true);
          return;
        }
        that.statusMessage.hide();
        container.find('.menu-item-subitem').find('span.menu-item-text').hide();
        container.find('.menu-item-subitem').find('span.menu-flag').hide();
        container.find('.menu-item-subitem').find('i.toggle-button-active').hide();
        container.find('.menu-item-subitem').find('span.menu-item-loader').show();
        $.blockUI.defaults.overlayCSS.opacity = 0.3;
        $.blockUI({message: null});
        proxy.toggle(function(obj) {
          $.unblockUI();
          container.find('.menu-item-subitem').find('span.menu-item-text').show();
          container.find('.menu-item-subitem').find('span.menu-flag').show();
          container.find('.menu-item-subitem').find('i.toggle-button-active').show();
          container.find('.menu-item-subitem').find('span.menu-item-loader').hide();
          if (obj.status == 'error') {
            that.setStatusMessage(that.ProxyManager.i18n['please_select_another_msg'], true);
          } else if (obj.status == 'success') {
            that.setStatusMessage('', false);
          } else if (obj.status == 'success disconnect') {
          }
          that.updateMenuItems();
        });
      }
    });
    that.lastClickTime = Date.now();

    //set active state
    proxy.isActive() && container.addClass('active');

    if (proxy.host.length !== 0) {
      container.addClass('free-proxy');
    }

    //method to update active state
    this.update = function () {
      //console.log('update');
      if (proxy.isActive()) {
        container.addClass('active');
        container.find('.toggle-button-active').show();
        container.find('.toggle-button').hide();
        container.find('.toggle-button-empty').hide();
      }
      else {
        container.removeClass('active');
        container.find('.toggle-button-active').hide();
        container.find('.toggle-button').hide();
        container.find('.toggle-button-empty').show();
      }
    };

    //add to parent container
    if (method === 'prepend') {
      container.prependTo(parent);
    } else {
      container.appendTo(parent);
    }
  },


  //Creates a proxy menu item
  createMenuItemDOMEl: function (proxy) {
    var that = this;

    var flag, name, item_loader,
    toggleButton, toggleButtonEmpty, toggleButtonActive, toggleButtonTurnOff,
    flagUrl, container;

    flagUrl = '../img/flags/' + (proxy.country === '??' || proxy.country === '' ? 'unknown' : proxy.country) + '.png';

    container = $('<div>').addClass('menu-item').attr('title', proxy.gateway);
    flag = $('<span>').addClass('menu-flag');//.css('backgroundImage', 'url(' + flagUrl + ')');

    flag.css('backgroundImage', 'url(' + flagUrl + ')');
        /**!!!!
          _bg.flagExists(proxy.country, function(bExists) {
          if (!bExists) {
          console.log('flag doesnt exists:', proxy.country);
          flag.css('backgroundImage', 'url(/data/img/flags/unknown.png)');
          } else {
          flag.css('backgroundImage', 'url(' + flagUrl + ')');
          }
          });
         **/

        name = $('<span>').addClass('menu-item-text').text(proxy.name);
        toggleButtonActive = $('<i>').addClass('toggle-button-active fa fa-arrow-right');
        toggleButton = $('<i>').addClass('toggle-button fa fa-arrow-right');
        toggleButtonEmpty = $('<i>').addClass('toggle-button-empty fa fa-arrow-right');
        toggleButtonTurnOff = $('<i>').addClass('toggle-button-turn-off fa fa-times');

        if (proxy.isActive()) {
          toggleButton.hide();
          toggleButtonEmpty.hide();
          toggleButtonTurnOff.hide();
        } else {
          toggleButtonActive.hide();
          toggleButton.hide();
          toggleButtonTurnOff.hide();
        }

        item_loader = $('<span>').addClass('menu-item-loader');
        item_loader.hide();

        var subitem = $('<span>').addClass('menu-item-subitem');
        subitem.append(toggleButton)
          .append(toggleButtonEmpty)
          .append(toggleButtonActive)
          .append(toggleButtonTurnOff)
          .append(flag)
          .append(name)
          .append(item_loader);

        //container.append(flag).append(name).append(toggleButton);
        //container.append(flag).append(nameAndButton);
        container.append(subitem);
        container.hover(
            function(){
              if ($(this).hasClass('active')) {
                $(this).find('.toggle-button-turn-off').show();
                $(this).find('.toggle-button-active').hide();
                $(this).find('.toggle-button').hide();
                $(this).find('.toggle-button-empty').hide();
              } else {
                $(this).find('.toggle-button-active').hide();
                $(this).find('.toggle-button').show();
                $(this).find('.toggle-button-empty').hide();
              }
            },
            //function(){ }
            function(){
              if ($(this).hasClass('active')) {
                $(this).find('.toggle-button-active').show();
                $(this).find('.toggle-button').hide();
                $(this).find('.toggle-button-empty').hide();
                $(this).find('.toggle-button-turn-off').hide();
              } else {
                $(this).find('.toggle-button-active').hide();
                $(this).find('.toggle-button').hide();
                $(this).find('.toggle-button-empty').show();
                $(this).find('.toggle-button-turn-off').hide();
              }
            }
        //function(){ toggleButton.show(); toggleButtonEmpty.hide() },
        //function(){ toggleButton.hide(); toggleButtonEmpty.show() }
        //function(){ $(this).addClass('hover') },
        //function(){ $(this).removeClass('hover') }
        );
        return container;
  },

  checkKey: function (key, cb) {
    var that = this;

    that.func_sendMessage('checkKey', 'key', key, function(status) {
      cb(status);
    });
  }
};

