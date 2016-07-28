/**
 * Created by Patrick_Pu on 16-07-10.
 */
var JC = 'JSON_CALLBACK';

angular.module('my_controller', [])

    .controller('SignupCtrl', function($scope, $http, CHAT_SERVER_URL, $state) {
        var enableUserRegistration = true;

        $scope.user = {};
        $scope.username_pattern = /^([a-zA-z]+(\ [a-zA-z]+)+)$/;

        $scope.doSignUp = function() {
            var params = _.extend($scope.user, {
                callback: JC
            });

            if (enableUserRegistration) {
                register();
            } else {
                $state.go("auth.login");
                console.info("registration is now disabled");
            }

            function register() {
                $http.jsonp(CHAT_SERVER_URL + '/register', {
                    params: params
                }).success(function(res) {
                    $state.go("auth.login");
                }).error(function(err) {
                    console.error(err);
                });
            }
        };
    })


    .controller('LoginCtrl', function($httpHelper, $http, $rootScope, $scope, $state,
                                      CHAT_SERVER_URL, $toast) {
        $scope.user = {
            username: 'Patrick Pu',
            password: '123'
        };
        useServerValidation();

        function useServerValidation() {
            $scope.selected_tab = "";

            $scope.$on('my-tabs-changed', function(event, data) {
                $scope.selected_tab = data.title;
            });

            $scope.doLogIn = login;

            function login() {
                console.log("login with ", $scope.user);

                $httpHelper.get(
                    CHAT_SERVER_URL + '/validateUser',
                    $scope.user,
                    function(res) {
                        console.log(res);
                        if (res.length == 1) {
                            pass(res[0]);
                        }else{
                            fail();
                        }
                    }
                );
            }

            function pass(user) {
                console.log("setting user to root: ", user);
                $rootScope.user = user;
                $state.go('app.wechat');
            }

            function fail(){
                $toast.show("Wrong username or password");
            }
        }
    })

    .controller('ChatCtrl', function($httpHelper, $rootScope, $scope, $stateParams, db, helper, CHAT_SERVER_URL) {
        $scope.$on("$ionicView.beforeEnter", function(scopes, states) {
            if (states.stateName == "app.chat") {
                $rootScope.activeView = states.stateName;
                refresh();
            }
        });

        var hasMore = true;
        var page = 1;

        $scope.loadMore = function(){
            page++;
            refresh();
        };

        var other = $stateParams.senderId;
        var me = $rootScope.user.username;

        if ($rootScope.socket) {
            $rootScope.socket.on('messageSent', refresh);
            $rootScope.socket.on('receiveMessage', refresh);
        }

        /**
         * avoid using function as ng-src
         * object has better functionality on $watch
         * @type {{}}
         */
        $scope.photoUrlCache = {};
        $scope.messages= [];
        $scope.message = "";

        $scope.isRight = function(message) {
            return message.senderId == me;
        };

        $scope.sendMessage = function() {
            if ($rootScope.socket) {
                $rootScope.socket.emit('sendMessage', {
                    senderId: me,
                    receiverId: other,
                    message: $scope.message,
                    time: new Date().getTime(),
                    unread: true
                });

                $scope.message = "";
            } else {
                console.error('Unable to connect to the chat server');
            }
        };

        refresh();

        function refresh() {
            if ($rootScope.activeView != "app.chat") {
                return;
            }

            if(!hasMore){
                console.log("no more messages");
                $scope.$broadcast('scroll.refreshComplete');
                return;
            }

            console.log("retrieving page #" + page);
            $httpHelper.get(
                CHAT_SERVER_URL + '/messages',
                {
                    senderId: other,
                    receiverId: me,
                    page: page
                },
                function(messages) {
                    var newMessages = _.sortBy(messages, function(it) {
                        return it.time;
                    });

                    if (newMessages && newMessages.length > 0){
                        $scope.messages = newMessages.concat($scope.messages);
                    }else{
                        hasMore = false;
                    }

                    //TODO something weird going on here, should it be done in WechatCtrl?
                    if (page == 1){
                        initPhotoUrl(messages);
                    }
                },
                null,
                function(){
                    $scope.$broadcast('scroll.refreshComplete');
                }
            );
        }

        function initPhotoUrl(messages) {
            var senders = _.countBy(messages, 'senderId');

            for (var senderId in senders) {
                getPhotoUrl(senderId);
            }
        }

        function getPhotoUrl(senderId){
            $httpHelper.get(
                CHAT_SERVER_URL + '/getPhotoUrl',
                {
                    username: senderId,
                },
                function(res) {
                    if (res.length == 1) {
                        $scope.photoUrlCache[senderId] = res[0].photoUrl;
                    }
                }
            );
        }
    }
    )

    .controller('WeChatCtrl', function($rootScope, $scope, db, CHAT_SERVER_URL, $http, $state, $timeout) {
        $scope.doRefresh = doRefresh;
        $scope.countNewMsg = countNewMsg;
        $scope.chatters = [];

        var refreshCount = 0;

        $scope.$on("$ionicView.beforeEnter", function(scopes, states) {
            if (states.fromCache && states.stateName == "app.wechat") {
                $rootScope.activeView = states.stateName;
                doRefresh();
            }
        });

        doRefresh();

        function doRefresh() {
            /**
             * Control that do refresh only 1 instance is running
             */
            refreshCount++;

            if (refreshCount > 1) {
                refreshCount--;
                return;
            }

            var receiverId = $rootScope.user.username;

            $http.jsonp(CHAT_SERVER_URL + '/getChatters', {
                params: {
                    username: receiverId,
                    callback: JC
                }
            }).success(function(res) {
                var chatters = _.without(res, receiverId);

                connectSocket(receiverId);
                countNewMsg(chatters);

            }).error(function(err) {
                console.error(err);
            }).finally(function() {
                $scope.$broadcast('scroll.refreshComplete');
            });
        }

        function connectSocket(receiverId) {
            /**
             * connect to server thru socket to get pushed notification
             */
            if (!$rootScope.socket) {
                var socket = io(CHAT_SERVER_URL);

                $rootScope.socket = socket;
                socket.on('connect', function() {});

                socket.emit('registerSocket', {
                    username: receiverId
                });

                socket.on('receiveMessage', function(msg) {
                    doRefresh();
               });
            }
        }

        /**
         * steps:
         * 1. count unread messages
         * 2. set most recent messages
         * 3. refresh count --   // this is not tested when have multiple chatters
         */

        function countNewMsg(chatters) {
            for (var i = 0; i < chatters.length; i++) {
                var chatter = chatters[i];
                countNewMsgById(chatter);
            }
        }

        function countNewMsgById(chatter) {
            var id = chatter.username;

            $http.jsonp(CHAT_SERVER_URL + '/countNewMessage', {
                params: {
                    senderId: id,
                    receiverId: $rootScope.user.username,
                    callback: JC
                }
            }).success(function(res) {
                chatter.count = res;
                getMostRecentMessage(chatter);
            }).error(function(err) {
                console.error(err);
            }).finally(function() {});
        }

        function getMostRecentMessage(chatter) {
            var id = chatter.username;

            $http.jsonp(CHAT_SERVER_URL + '/getRecentMsg', {
                params: {
                    senderId: id,
                    receiverId: $rootScope.user.username,
                    callback: JC
                }
            }).success(function(res) {
                chatter.recentMsg = res[0].message;
                var findChatter = false;
                /**
                 * try to replace chatter as late as possible
                 * to avoid flickering
                 */
                for (var i = 0; i < $scope.chatters.length; i++) {
                    if ($scope.chatters[i].username == chatter.username) {
                        $scope.chatters[i] = chatter;
                        findChatter = true;
                        break;
                    }
                }

                if (!findChatter) {
                    $scope.chatters.push(chatter);
                }
            }).error(function(err) {
                console.error(err);
            }).finally(function() {
                refreshCount--;
            });
        }
    })

    .controller('ContactCtrl', function($scope, db) {
        $scope.contacts = _.sortBy(db.chats, function(obj) {
            return obj.name;
        });
    })

    .controller('DiscoverCtrl', function($scope) {

    })

    .controller('ProfileCtrl', function($scope, $rootScope){
        $scope.user = $rootScope.user;
    });