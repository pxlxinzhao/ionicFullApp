/**
 * Created by Patrick_Pu on 16-07-10.
 */

var JC = 'JSON_CALLBACK';

angular.module('my_controller', [])

    .controller('SignupCtrl', function ($scope, $http, CHAT_SERVER_URL, $state) {
        var enableUserRegistration = false;

        $scope.user = {};
        $scope.username_pattern = /^([a-zA-z]+(\ [a-zA-z]+)+)$/;

        $scope.doSignUp = function () {
            var params = _.extend($scope.user, {callback: JC});
            //console.log(params);

            if (enableUserRegistration){
                register();
            }else{
                $state.go("auth.login");
                console.info("registration is now disabled")
            }

            function register(){
                $http.jsonp(CHAT_SERVER_URL + '/register',
                    {
                        params: params
                    }).success(function(res){
                        //console.log(res);
                        $state.go("auth.login");
                    }).error(function(err){
                        console.error(err);
                    })
            }
        };
    })


    .controller('LoginCtrl', function ($http, $rootScope, $scope, $state,
                                       CHAT_SERVER_URL, $templateCache, $q, $rootScope) {
        $scope.user = {
            username: 'Patrick Pu',
            password: '123'
        };
        useServerValidation();

        function useServerValidation(){
            $scope.selected_tab = "";

            $scope.$on('my-tabs-changed', function (event, data) {
                $scope.selected_tab = data.title;
            });

            $scope.doLogIn = login;

            function login(){
                var params = _.extend($scope.user, {callback: JC});

                $http.jsonp(CHAT_SERVER_URL + '/validateUser',
                    {
                        params: params
                    }).success(function(res){
                        //console.log(res);
                        if (res.length == 1){
                            pass();
                        }
                    }).error(function(err){
                        console.error(err);
                    })
            }

            function pass(){
                //console.log("passed validation");
                $rootScope.user = $scope.user;
                $state.go('app.wechat');
            }
        }
    })

    .controller('ChatCtrl', function ($http, $rootScope, $scope, $stateParams, db, helper, CHAT_SERVER_URL) {

        $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {
            //console.log("states", states);
            if( states.stateName == "app.chat" ) {
                $rootScope.activeView = states.stateName
                //console.log("activeView is: ", states.stateName);

                refresh();
            }
        });

        var other = $stateParams.senderId;
        var me = $rootScope.user.username;

        //console.log('initializing socket')
        if ($rootScope.socket){
            $rootScope.socket.on('messageSent', refresh)
            $rootScope.socket.on('receiveMessage', refresh)
        }

        /**
         * avoid using function as ng-src
         * object has better functionality on $watch
         * @type {{}}
         */
        $scope.photoUrlCache = {};

        $scope.message = "";

        $scope.isRight = function (message) {
            return message.senderId == me;
        }

        $scope.sendMessage = function () {
            //console.log('sending message')

            if($rootScope.socket){
                $rootScope.socket.emit('sendMessage',
                    {
                        senderId: me,
                        receiverId: other,
                        message: $scope.message,
                        time: new Date().getTime(),
                        unread: true
                    }
                )
            }else{
                console.error('Unable to connect to the chat server');
            }
        }

        refresh();

        function refresh(){
            if ($rootScope.activeView != "app.chat"){
                return;
            }

            $http.jsonp(CHAT_SERVER_URL + '/messages',
                {
                    params: {
                        senderId: other,
                        receiverId: me,
                        // this param is essential
                        callback: JC
                    }
                }).success(function(messages){
                    //console.log('getting messages: ', messages);
                    $scope.messages = _.sortBy(messages, function (it) {
                        return it.time
                    });

                    initPhotoUrl(messages);
                }).error(function(error){
                    //console.error('getting error: ', error);
                }
            )
        }

        function initPhotoUrl(messages){
            var senders = _.countBy(messages, 'senderId');

            for (var senderId in senders){
                /**
                 * capture senderId in a closure
                 */
                (function(senderId){
                    $http.jsonp(CHAT_SERVER_URL + '/getPhotoUrl',
                        {
                            params: {
                                username: senderId,
                                callback: JC
                            }
                        }).success(function(res){
                            //console.log('res', res);

                            if (res.length == 1){
                                //console.log('setting user ' + $scope.photoUrlCache[senderId]
                                //    + 'with ' + res[0].photoUrl);
                                $scope.photoUrlCache[senderId] = res[0].photoUrl;
                            }
                            //console.log($scope.photoUrlCache);
                        }).error(function(err){
                            console.error(err);
                        })
                })(senderId)

            }
        }
    })

    .controller('WeChatCtrl', function ($rootScope, $scope, db, CHAT_SERVER_URL, $http, $state, $timeout) {
        $scope.doRefresh = doRefresh;
        $scope.countNewMsg = countNewMsg;

        var refreshCount = 0;

        $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {
            if( states.fromCache && states.stateName == "app.wechat" ) {
                $rootScope.activeView = states.stateName
                //console.log("activeView is: ", states.stateName);

                doRefresh(true);
            }
        });

        doRefresh(true);

        function doRefresh(count){
            /**
             * Control that do refresh only 1 instance is running
             */
            //console.log("count", count);

            if (count){
                //console.log("plus count");
                refreshCount++;
            }

            //console.log("refreshCount", refreshCount);
            if (refreshCount > 1) {
                /**
                 * This is for defer the refresh, not working very well
                 * needs to comment out refreshCount--
                 * because it's going to happen in the callback
                 */
                /*$timeout(function(){
                    console.log("doRefresh is already in process, thus wait");
                    doRefresh(false);
                },1000);*/

                /**
                 * Doing nothing if refresh already happened
                 */
                //console.log("aborting refresh");
                refreshCount--;
                return;
            }

            $scope.chatters = [];
            var receiverId = $rootScope.user.username;
            //if (!receiverId) return;

            $http.jsonp(CHAT_SERVER_URL + '/getChatters',
                {
                    params: {
                        username: receiverId,
                        callback: JC
                    }
                }).success(function(res){
                    var chatters = _.without(res, receiverId);

                    connectSocket(receiverId);
                    countNewMsg(chatters);

                    //console.log('chatters', chatters);
                }).error(function(err){
                    console.error(err);
                }).finally(function(){
                    $scope.$broadcast('scroll.refreshComplete');
                    //console.log("minus count");
                }
            )
        }

        function connectSocket(receiverId){
            /**
             * connect to server thru socket to get pushed notification
             */
            if (!$rootScope.socket){
                var socket = io(CHAT_SERVER_URL);

                $rootScope.socket = socket;
                socket.on('connect', function(){
                    //console.log('successfully connected');
                })

                socket.emit('registerSocket', {
                    username: receiverId
                })

                socket.on('receiveMessage', function(msg){
                    //console.log('new message', msg);
                    doRefresh(true);
                })
            }
        }

        /**
         * steps:
         * 1. count unread messages
         * 2. set most recent messages
         * 3. refresh count --   // this is not tested when have multiple chatters
         */

        function countNewMsg(chatters){
            for (var i=0; i<chatters.length; i++){
                var chatter = chatters[i];
                countNewMsgById(chatter);
            }
        }

        function getMostRecentMessage(chatter){
            var id = chatter.username;

            $http.jsonp(CHAT_SERVER_URL + '/getRecentMsg',
                {
                    params: {
                        senderId: id,
                        receiverId: $rootScope.user.username,
                        callback: JC
                    }
                }).success(function(res){
                    //console.log("get most recent message is: ", res);
                    chatter.recentMsg = res[0].message;
                    $scope.chatters.push(chatter);
                }).error(function(err){
                    console.error(err);
                }).finally(function(){
                    refreshCount--;
                }
            )
        }

        function countNewMsgById(chatter){
            var id = chatter.username;

            $http.jsonp(CHAT_SERVER_URL + '/countNewMessage',
                {
                    params: {
                        senderId: id,
                        receiverId: $rootScope.user.username,
                        callback: JC
                    }
                }).success(function(res){
                    //console.log("setting count to:", res);
                    chatter.count = res;
                    getMostRecentMessage(chatter);

                    //console.log('sender: ' + id + ' has ' + res + ' messages');
                }).error(function(err){
                    console.error(err);
                }).finally(function(){
                }
            )
        }
    })

    .controller('ContactCtrl', function ($scope, db) {
        //console.log('loading contact');
        $scope.contacts = _.sortBy(db.chats, function (obj) {
            return obj.name;
        });
    })

    .controller('DiscoverCtrl', function ($scope) {

    })
;