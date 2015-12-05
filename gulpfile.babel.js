'use strict';

import gulp from 'gulp';
import plugins from 'gulp-load-plugins';
import {spawnSync} from 'child_process';
const $ = plugins();

gulp.task('default', ['watch', 'babelify']);

gulp.task('watch', function () {
  gulp.watch(['src/**/*'], ['babelify']);
});

gulp.task('babelify', function () {
  return gulp.src('./src/**/*')
    .pipe($.plumber())
    .pipe($.babel())
    .pipe($.chmod(755))
    .pipe(gulp.dest('bin'))
    .on('end', function () {
      console.log(spawnSync('gic').stdout.toString());
    });
});
