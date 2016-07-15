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
            console.log(params);

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
                        console.log(res);
                        $state.go("auth.login");
                    }).error(function(err){
                        console.log(err);
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
                        console.log(res);
                        if (res.length == 1){
                            pass();
                        }
                    }).error(function(err){
                        console.log(err);
                    })
            }

            function pass(){
                $rootScope.user = $scope.user;
                $state.go('app.wechat');
            }
        }
        /**
         * This is using json to validate
         * Not used
         */
        function useJsonValidation(){
            $http.get('setting/user-preference.json').success(function (data) {

                $scope.user.email = data.username;
                $scope.user.pin = "12345";

                // We need this for the form validation
                $scope.selected_tab = "";

                $scope.$on('my-tabs-changed', function (event, data) {
                    $scope.selected_tab = data.title;
                });

                $scope.doLogIn = function () {
                    if ($scope.user && $scope.user.email && $scope.user.email.length > 0) {
                        $rootScope.user = $scope.user;
                        $state.go('app.weixinProxy');
                    }else{
                        console.info('username has to be longer than 3 letters', $scope.user);
                    }
                };
            })
        }

    })

    .controller('ChatCtrl', function ($http, $rootScope, $scope, $stateParams, db, helper, CHAT_SERVER_URL) {
        var other = $stateParams.senderId;
        var me = $rootScope.user.username;

        console.log('initializing socket')
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
                        time: new Date().getTime()
                    }
                )
            }else{
                console.error('Unable to connect to the chat server');
            }
        }

        refresh();

        function refresh(){
            $http.jsonp(CHAT_SERVER_URL + '/messages',
                {
                    params: {
                        senderId: other,
                        receiverId: me,
                        // this param is essential
                        callback: JC
                    }
                }).success(function(messages){
                    console.log('getting messages: ', messages);
                    $scope.messages = _.sortBy(messages, function (it) {
                        return it.time
                    });

                    initPhotoUrl(messages);
                }).error(function(error){
                    console.log('getting error: ', error);
                }
            )
        }

        /**
         * Deprecated
         */
        function manuallyInsertMessage(){
            if ($scope.message && $scope.message.length > 0){
                $scope.messages.push({
                    senderId: me,
                    receiverId: other,
                    message: $scope.message,
                    timestamp: new Date().getTime()
                });

                $scope.message = "";
                $scope.$apply();
            }
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
                            console.log(err);
                        })
                })(senderId)

            }
        }

        /**
         * For retrieving fake messages
         * Deprecated
         * @returns {*}
         */
        function retrieveMessages(){
            return messages = _.filter(db.messages, function (record) {
                return (record.senderId == senderId && record.receiverId == receiverId)
                    || (record.receiverId == senderId && record.senderId == receiverId)
            });
        }

    })

    .controller('ContactCtrl', function ($scope, db) {
        console.log('loading contact');
        $scope.contacts = _.sortBy(db.chats, function (obj) {
            return obj.name;
        });
    })

    .controller('WeChatCtrl', function ($rootScope, $scope, db, CHAT_SERVER_URL, $http) {
        console.log('loading WeChatCtrl')
        $scope.chatters = [];
        $scope.doRefresh = doRefresh;

        doRefresh();

        function doRefresh(){
            if (!$rootScope || !$rootScope.user) {
                console.error('please log in');
                return;
            }

            console.log('calling refresh');

            var receiverId = $rootScope.user.username;
            if (!receiverId) return;

            $http.jsonp(CHAT_SERVER_URL + '/getChatters',
                {
                    params: {
                        username: receiverId,
                        callback: JC
                    }
                }).success(function(res){
                    var chatters = _.without(res, receiverId);
                    $scope.chatters = chatters;
                    listChatters(receiverId);
                    console.log('chatters', chatters);
                }).error(function(err){
                    console.log(err);
                }).finally(function(){
                    $scope.$broadcast('scroll.refreshComplete');
                }
            )
        }

        function listChatters(receiverId){
            /**
             * connect to server thru socket to get pushed notification
             */
            if (!$rootScope.socket){
                var socket = io(CHAT_SERVER_URL);

                $rootScope.socket = socket;
                socket.on('connect', function(){
                    console.log('successfully connected');
                })

                socket.emit('registerSocket', {
                    username: receiverId
                })
            }
        }
    })

    .controller('DiscoverCtrl', function ($scope) {

    })
;