var gulp = require('gulp');

var requireDir = require('require-dir');
requireDir('./gulp-tasks');

gulp.task('default', ['sass', 'templatecache']);

//var plumber = require('gulp-plumber');
////var coffee = require('gulp-coffee');
//
//gulp.src('./src/*.ext')
//    .pipe(plumber())
//    //.pipe(coffee())
//    .pipe(gulp.dest('./dist'));
//
//gulp.task('sass', function(done) {
//    gulp.src('./scss/ionic.app.scss')
//        .pipe(sass({errLogToConsole: true}))
//        .pipe(gulp.dest('./www/css/'))
//        .pipe(minifyCss({
//            keepSpecialComments: 0
//        }))
//        .pipe(rename({ extname: '.min.css' }))
//        .pipe(gulp.dest('./www/css/'))
//        .on('end', done);
//});