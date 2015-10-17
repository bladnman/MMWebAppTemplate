
/**
 *  CONFIGURE
 */
// distribution or build directory
var BUILD_PATH          = './dist';

// the build folder to host all js files
var SCRIPTS_PATH        = BUILD_PATH + '/js';

// where the source files can be found
var SOURCE_PATH         = './src';

// where the static files can be found
var STATIC_PATH         = './static';

// the entry file of your js application
var ENTRY_FILE          = SOURCE_PATH + '/main.js';

// the final output js file name
var OUTPUT_FILE           = 'app.js';

/**
 *  IMPORT
 */

var gulp            = require('gulp');
var del             = require('del');
var sourcemaps      = require('gulp-sourcemaps');
var source          = require('vinyl-source-stream');
var buffer          = require('vinyl-buffer');
var browserify      = require('browserify');
var babel           = require('babelify');
var gutil           = require('gulp-util');
var uglify          = require('gulp-uglify');
var gulpif          = require('gulp-if');
var exorcist        = require('exorcist');
var browserSync     = require('browser-sync');
var argv            = require('yargs').argv;

var keepFiles       = false;


/**
 *  WORKERS
 */

/**
 * Simple way to check for development/production mode.
 */
function isProduction() {
	return argv.production;
}
/**
 * Deletes all content inside the './build' folder.
 * If 'keepFiles' is true, no files will be deleted. This is a dirty workaround since we can't have
 * optional task dependencies :(
 * Note: keepFiles is set to true by gulp.watch (see serve()) and reseted here to avoid conflicts.
 */
function removeAllFiles() {
	if (!keepFiles) {
		del([BUILD_PATH + '**/*.*']);
	} else {
		keepFiles = false;
	}
}
function logBuildMode() {

	if (isProduction()) {
		gutil.log(gutil.colors.green('Running production build...'));
	}

	else {
		gutil.log(gutil.colors.yellow('Running development build...'));
	}

}
/**
 * Copies the content of the './static' folder into the '/build' folder.
 * Check out README.md for more info on the '/static' folder.
 */
function copyStatic() {
	return gulp.src(STATIC_PATH + '/**/*')
						.pipe(gulp.dest(BUILD_PATH + '/'));
}
function cleanBuild() {
	gutil.log(gutil.colors.blue('Starting CLEAN BUILD...'));

	gutil.log(gutil.colors.blue('  - removing all files'));
	removeAllFiles();

	gutil.log(gutil.colors.blue('  - copying all static files'));
	copyStatic();

	gutil.log(gutil.colors.blue('  - building'));
	build();
}
/**
 * Transforms ES2015 code into ES5 code.
 * Optionally: Creates a sourcemap file 'game.js.map' for debugging.
 *
 * In order to avoid copying Phaser and Static files on each build,
 * I've abstracted the build logic into a separate function. This way
 * two different tasks (build and fastBuild) can use the same logic
 * but have different task dependencies.
 */
function build() {

	var sourcemapPath = SCRIPTS_PATH + '/' + OUTPUT_FILE + '.map';

	logBuildMode();

	return browserify({
		entries: ENTRY_FILE,
		debug: true
	})
	.transform(babel)
	.bundle().on('error', function(error){
		             gutil.log(gutil.colors.red('[Build Error]', error.message));
		             this.emit('end');
	             })
						.on('end', function() {})
	.pipe(gulpif(!isProduction(), exorcist(sourcemapPath)))
	.pipe(source(OUTPUT_FILE))
	.pipe(buffer())
	.pipe(gulpif(isProduction(), uglify()))
	.pipe(gulp.dest(SCRIPTS_PATH));

}
/**
 * Starts the Browsersync server.
 * Watches for file changes in the 'src' folder.
 */
function serve() {

	var options = {
		notify : true,

		server: {
			baseDir: BUILD_PATH
		},
		open: true // Change it to true if you wish to allow Browsersync to open a browser window.

	};

	browserSync(options);

	// Watches for changes in files inside the './src' folder.
	gulp.watch(SOURCE_PATH + '/**/*.js', ['watch-js']);

	// Watches for changes in files inside the './static' folder. Also sets 'keepFiles' to true (see cleanBuild()).
	gulp.watch(STATIC_PATH + '/**/*', ['watch-static']).on('change', function() {
		keepFiles = true;
	});
}


/**
 *  TASKS
 */
gulp.task('build', build);
gulp.task('clean-build', cleanBuild);
gulp.task('remove-all-files', removeAllFiles);
gulp.task('copy-static', ['remove-all-files'], copyStatic);
gulp.task('watch-js', ['build'], browserSync.reload); // Rebuilds and reloads the project when executed.
gulp.task('watch-static', ['copy-static'], browserSync.reload);
gulp.task('serve', ['clean-build'], serve);
gulp.task('default', ['serve']);