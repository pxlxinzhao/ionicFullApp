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
                            if (res.length == 1){
                                $scope.photoUrlCache[senderId] = res[0].photoUrl;
                            }
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
        $scope.chatters = []

        var refreshCount = 0;

        $scope.$on( "$ionicView.beforeEnter", function( scopes, states ) {
            if( states.fromCache && states.stateName == "app.wechat" ) {
                $rootScope.activeView = states.stateName
                doRefresh();
            }
        });

        doRefresh();

        function doRefresh(){
            /**
             * Control that do refresh only 1 instance is running
             */
            refreshCount++;

            if (refreshCount > 1) {
                refreshCount--;
                return;
            }

            var receiverId = $rootScope.user.username;

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

                }).error(function(err){
                    console.error(err);
                }).finally(function(){
                    $scope.$broadcast('scroll.refreshComplete');
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
                })

                socket.emit('registerSocket', {
                    username: receiverId
                })

                socket.on('receiveMessage', function(msg){
                    doRefresh();
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
                    chatter.count = res;
                    getMostRecentMessage(chatter);
                }).error(function(err){
                    console.error(err);
                }).finally(function(){
                }
            )
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
                    chatter.recentMsg = res[0].message;
                    var findChatter = false
                    /**
                     * try to replace chatter as late as possible
                     * to avoid flickering
                     */
                    for (var i=0; i<$scope.chatters.length; i++){
                        if ($scope.chatters[i].username == chatter.username){
                            $scope.chatters[i] = chatter;
                            findChatter = true;
                            break;
                        }
                    }

                    if (!findChatter){
                        $scope.chatters.push(chatter);
                    }
                }).error(function(err){
                    console.error(err);
                }).finally(function(){
                    refreshCount--;
                }
            )
        }
    })

    .controller('ContactCtrl', function ($scope, db) {
        $scope.contacts = _.sortBy(db.chats, function (obj) {
            return obj.name;
        });
    })

    .controller('DiscoverCtrl', function ($scope) {

    })
;