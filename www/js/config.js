angular.module('your_app_name.config', [])
.constant('WORDPRESS_API_URL', 'http://wordpress.startapplabs.com/blog/api/')
.constant('GCM_SENDER_ID', '574597432927')
.config(function($httpProvider){
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
})

;
