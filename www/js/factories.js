//"use strict";

angular.module('your_app_name.factories', [])

    .factory('FeedLoader', function($resource) {
      return $resource('http://ajax.googleapis.com/ajax/services/feed/load', {}, {
        fetch: {
          method: 'JSONP',
          params: {
            v: '1.0',
            callback: 'JSON_CALLBACK'
          }
        }
      });
    })


// Factory for node-pushserver (running locally in this case), if you are using other push notifications server you need to change this
    .factory('NodePushServer', function($http) {
      // Configure push notifications server address
      // 		- If you are running a local push notifications server you can test this by setting the local IP (on mac run: ipconfig getifaddr en1)
      var push_server_address = "http://192.168.1.102:8000";

      return {
        // Stores the device token in a db using node-pushserver
        // type:  Platform type (ios, android etc)
        storeDeviceToken: function(type, regId) {
          // Create a random userid to store with it
          var user = {
            user: 'user' + Math.floor((Math.random() * 10000000) + 1),
            type: type,
            token: regId
          };
          console.log("Post token for registered device with data " + JSON.stringify(user));

          $http.post(push_server_address + '/subscribe', JSON.stringify(user))
              .success(function(data, status) {
                console.log("Token stored, device is successfully subscribed to receive push notifications.");
              })
              .error(function(data, status) {
                console.log("Error storing device token." + data + " " + status);
              });
        },
        // CURRENTLY NOT USED!
        // Removes the device token from the db via node-pushserver API unsubscribe (running locally in this case).
        // If you registered the same device with different userids, *ALL* will be removed. (It's recommended to register each
        // time the app opens which this currently does. However in many cases you will always receive the same device token as
        // previously so multiple userids will be created with the same token unless you add code to check).
        removeDeviceToken: function(token) {
          var tkn = {
            "token": token
          };
          $http.post(push_server_address + '/unsubscribe', JSON.stringify(tkn))
              .success(function(data, status) {
                console.log("Token removed, device is successfully unsubscribed and will not receive push notifications.");
              })
              .error(function(data, status) {
                console.log("Error removing device token." + data + " " + status);
              });
        }
      };
    })


    .factory('AdMob', function($window) {
      var admob = $window.AdMob;

      if (admob) {
        // Register AdMob events
        // new events, with variable to differentiate: adNetwork, adType, adEvent
        document.addEventListener('onAdFailLoad', function(data) {
          console.log('error: ' + data.error +
              ', reason: ' + data.reason +
              ', adNetwork:' + data.adNetwork +
              ', adType:' + data.adType +
              ', adEvent:' + data.adEvent); // adType: 'banner' or 'interstitial'
        });
        document.addEventListener('onAdLoaded', function(data) {
          console.log('onAdLoaded: ' + data);
        });
        document.addEventListener('onAdPresent', function(data) {
          console.log('onAdPresent: ' + data);
        });
        document.addEventListener('onAdLeaveApp', function(data) {
          console.log('onAdLeaveApp: ' + data);
        });
        document.addEventListener('onAdDismiss', function(data) {
          console.log('onAdDismiss: ' + data);
        });

        var defaultOptions = {
          // bannerId: admobid.banner,
          // interstitialId: admobid.interstitial,
          // adSize: 'SMART_BANNER',
          // width: integer, // valid when set adSize 'CUSTOM'
          // height: integer, // valid when set adSize 'CUSTOM'
          position: admob.AD_POSITION.BOTTOM_CENTER,
          // offsetTopBar: false, // avoid overlapped by status bar, for iOS7+
          bgColor: 'black', // color name, or '#RRGGBB'
          // x: integer,		// valid when set position to 0 / POS_XY
          // y: integer,		// valid when set position to 0 / POS_XY
          isTesting: true // set to true, to receiving test ad for testing purpose
          // autoShow: true // auto show interstitial ad when loaded, set to false if prepare/show
        };
        var admobid = {};

        if (ionic.Platform.isAndroid()) {
          admobid = { // for Android
            banner: 'ca-app-pub-6869992474017983/9375997553',
            interstitial: 'ca-app-pub-6869992474017983/1657046752'
          };
        }

        if (ionic.Platform.isIOS()) {
          admobid = { // for iOS
            banner: 'ca-app-pub-6869992474017983/4806197152',
            interstitial: 'ca-app-pub-6869992474017983/7563979554'
          };
        }

        admob.setOptions(defaultOptions);

        // Prepare the ad before showing it
        // 		- (for example at the beginning of a game level)
        admob.prepareInterstitial({
          adId: admobid.interstitial,
          autoShow: false,
          success: function() {
            console.log('interstitial prepared');
          },
          error: function() {
            console.log('failed to prepare interstitial');
          }
        });
      } else {
        console.log("No AdMob?");
      }

      return {
        showBanner: function() {
          if (admob) {
            admob.createBanner({
              adId: admobid.banner,
              position: admob.AD_POSITION.BOTTOM_CENTER,
              autoShow: true,
              success: function() {
                console.log('banner created');
              },
              error: function() {
                console.log('failed to create banner');
              }
            });
          }
        },
        showInterstitial: function() {
          if (admob) {
            // If you didn't prepare it before, you can show it like this
            // admob.prepareInterstitial({adId:admobid.interstitial, autoShow:autoshow});

            // If you did prepare it before, then show it like this
            // 		- (for example: check and show it at end of a game level)
            admob.showInterstitial();
          }
        },
        removeAds: function() {
          if (admob) {
            admob.removeBanner();
          }
        }
      };
    })

    .factory('iAd', function($window) {
      var iAd = $window.iAd;

      // preppare and load ad resource in background, e.g. at begining of game level
      if (iAd) {
        iAd.prepareInterstitial({
          autoShow: false
        });
      } else {
        console.log("No iAd?");
      }

      return {
        showBanner: function() {
          if (iAd) {
            // show a default banner at bottom
            iAd.createBanner({
              position: iAd.AD_POSITION.BOTTOM_CENTER,
              autoShow: true
            });
          }
        },
        showInterstitial: function() {
          // ** Notice: iAd interstitial Ad only supports iPad.
          if (iAd) {
            // If you did prepare it before, then show it like this
            // 		- (for example: check and show it at end of a game level)
            iAd.showInterstitial();
          }
        },
        removeAds: function() {
          if (iAd) {
            iAd.removeBanner();
          }
        }
      };
    })

    .factory('helper', function() {
      return {
        createChatRoomId: function() {
          return _.sortBy(arguments, function(x) {
            return x;
          }).join(' ').replace(/\s/g, '');
        }
      };
    })

    .factory('$toast', function($cordovaToast) {
      return {
        show: function(message) {
          var isIOS = ionic.Platform.isIOS();
          var isAndroid = ionic.Platform.isAndroid();
          var isWindowsPhone = ionic.Platform.isWindowsPhone();

          if (isIOS || isAndroid || isWindowsPhone){
            $cordovaToast.show(message, 'long', 'center');
          }else{
            console.log(message);
          }
        }
      };
    })

    .factory('$httpHelper', function($http){
      return {
        get: function(url, param, success, error, final){
          if (!error) error = function(err){console.info(err);};

          //var isIOS = ionic.Platform.isIOS();
          //var isAndroid = ionic.Platform.isAndroid();
          //var isWindowsPhone = ionic.Platform.isWindowsPhone();

          var req2 = _.extend(param, {callback: "JSON_CALLBACK"});
          $http.jsonp(url, {params: req2}).success(success).error(error).finally(final);

        }
      };

    })

    .factory('db', function() {
      return {
        chats: [{
          name: "Mandi Gross",
          message: "Quisque ornare nulla eu sem convallis pellentesque. Cras at sagittis augue. Nam bibendum dui sit amet ante.",
          url: "img/people/001.jpg"
        }, {
          name: "Netta Nobel",
          message: "Donec eu nulla ut mi dignissim ornare. Curabitur maximus dui orci, quis semper mauris bibendum id. Aliquam.",
          url: "img/people/002.jpg"
        }, {
          name: "Kassey Kawamura",
          message: "Nullam magna tellus, iaculis hendrerit odio ac, ornare pretium libero. Donec dapibus, diam in egestas convallis, lorem.",
          url: "img/people/003.jpg"
        }, {
          name: "Betty Candaele",
          message: "Vivamus pulvinar ipsum non mauris dapibus, eget vestibulum sem lacinia. Duis porta nisl ac euismod congue. Sed turpis nisl, egestas eget sapien at, imperdiet lobortis.",
          url: "img/people/004.jpg"
        }, {
          name: "Perle Gannon",
          message: "Dictum feugiat consequat erat senectus primis nostra hac nec justo curabitur ante, purus interdum risus luctus nibh consectetur scelerisque nulla porta.",
          url: "img/people/005.jpg"
        }, {
          name: "Brietta Fenske",
          message: "Cras rutrum augue blandit vel quisque urna aenean ornare duis tortor curae, nulla lacinia at iaculis habitant lobortis gravida ipsum viverra hac a pharetra augue duis ante nec sed lobortis curae volutpat.",
          url: "img/people/006.jpg"
        }, {
          name: "Holly Salvatore",
          message: "Fringilla euismod volutpat fermentum mauris ut ultrices massa, hendrerit litora augue mauris vivamus vel quam et, ullamcorper per mattis etiam felis faucibus.",
          url: "img/people/007.jpg"
        }, {
          name: "Lilas Pierpont",
          message: "At amet lorem urna magna sociosqu vivamus sociosqu, posuere class fringilla urna pulvinar mattis, ultricies odio non aliquam sodales primis.",
          url: "img/people/008.jpg"
        }, {
          name: "Valina Policar",
          message: "Suspendisse lacinia eros lacinia condimentum tortor phasellus hac urna tristique auctor, malesuada sit quam fusce mollis accumsan arcu curae consectetur vehicula, nostra lobortis et pellentesque cubilia eros posuere aliquam tristique.",
          url: "img/people/009.jpg"
        }, {
          name: "Godiva Daldalian",
          message: "Sapien non etiam egestas potenti elementum tortor tempus per est quisque sed vestibulum tempus hac metus massa, praesent tortor purus aliquam gravida amet scelerisque nullam odio habitasse mauris dictum ultricies nam.",
          url: "img/people/010.jpg"
        }, {
          name: "Nakashima Yuko",
          message: "Nulla consequat facilisis proin sed ligula libero gravida ultrices, sollicitudin at in tincidunt eget suscipit placerat, enim sociosqu enim libero semper ac sed.",
          url: "img/people/011.jpg"
        }],

        messages: [{
          senderId: "Mandi Gross",
          receiverId: "Patrick Pu",
          message: "Hello, how are you?",
          timestamp: 1465588012
        }, {
          senderId: "Patrick Pu",
          receiverId: "Mandi Gross",
          message: "I am hungry, go grab a lunch?",
          timestamp: 1465688012
        }, {
          senderId: "Mandi Gross",
          receiverId: "Patrick Pu",
          message: "Why not? Let's go",
          timestamp: 1465788012
        }]
      };
    });