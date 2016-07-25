angular.module('your_app_name.config', [])
.constant('WORDPRESS_API_URL', 'http://wordpress.startapplabs.com/blog/api/')
.constant('GCM_SENDER_ID', '574597432927')

/**
 * Switch chat server between test and production
 */
.constant('CHAT_SERVER_URL', 'https://wechat-p.herokuapp.com')
//.constant('CHAT_SERVER_URL', 'https://wechat-pxlxinzhao.c9users.io:8080')
;
