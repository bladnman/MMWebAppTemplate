/**
 *  GULP
 *
 *  USAGE:
 *    gulp [task] [options]
 *
 *
 *  OPTIONS
 *
 *    (first item in lists is default)
 *
 *    --target=[development|test|production]
 *    --autoreload=[true|false]
 *    --lint=[true|false]
 *    --fixtures=[false|true]
 *    --lintFatal=[false|true]
 *    --environment=[development|test|production]
 *
 *
 *  EXAMPLES
 *
 *    gulp --autoreload=false
 *      <- will result in non-reloading, development target, development environment, no fixtures
 *
 *    gulp --environment=test --target=test
 *      <- will result in reloading, test target, test environment, no fixtures
 *
 */


/**
 *  CONFIGURE
 */
// distribution or build directory
var BUILD_PATH            = './dist';

// the build folder to h  ost all js files
var SCRIPTS_PATH        = BUILD_PATH + '/js';

// where the source files can be found
var SOURCE_PATH           = './src';

// where the static files can be found
var STATIC_PATH           = './static';

// the entry file of your js application
var ENTRY_FILE            = SOURCE_PATH + '/main.js';

// the final output js file name
var OUTPUT_FILE           = 'app.js';

// lint before dev builds
var LINT_ON_DEV_BUILDS    = true;

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
var eslint          = require('gulp-eslint');
var browserSync     = require('browser-sync');
var notify          = require('gulp-notify');
var argv            = require('yargs').argv;
var beep            = require('beepbeep');
var plumber         = require('gulp-plumber');
var filesize        = require('gulp-filesize');
var notifier        = require('node-notifier');

var keepFiles       = false;

var getBooleanValue = function (object, defaultVal) {
  if ( typeof object === 'undefined' || object === null ) {
    return defaultVal;
  }

  var stringValue				= object.toString().toLowerCase();
  switch (stringValue) {
    case 'true':
      return true;
    case 't':
      return true;
    case '1':
      return true;
    case 'yes':
      return true;
    case 'y':
      return true;
    case 'checked':
      return true;
    case 'selected':
      return true;
    case 'on':
      return true;

    default:
      return false;
  }
};

/**
 *  GULP ARGUMENTS
 *
 *  Capture some CLI toggles
 */
var shouldAutoReload= getBooleanValue(argv.autoreload,    true);
var fixtures        = getBooleanValue(argv.fixtures,      false);
var shouldLint      = getBooleanValue(argv.lint,          true);
var isLintFatal     = getBooleanValue(argv.lintfatal,     false);
var target          = (argv && argv.target)               || 'development';
var environment     = (argv && argv.environment)          || 'development';

function isProduction() {
  return environment === 'production';
}
function isDevelopment() {
  return environment === 'development';
}
function isTest() {
  return environment === 'test';
}
function clean() {
	if (!keepFiles) {
		del([BUILD_PATH + '**/*.*']);
	} else {
		keepFiles = false;
	}
}
function logEnvironment() {

  var colorFunc = gutil.colors.green;

	if (isProduction()) {
    colorFunc = gutil.colors.green;
	}

  else if (isTest()) {
    colorFunc = gutil.colors.magenta;
  }

  else {
    colorFunc = gutil.colors.cyan;
  }

  gutil.log('----------------------------------');
  gutil.log(gutil.colors.yellow('Environment :'));
  gutil.log('----------------------------------');
  gutil.log('   - ' + colorFunc('target'), '          [' + target + ']');
  gutil.log('   - ' + colorFunc('environment'), '     [' + environment + ']');
  gutil.log('   - ' + colorFunc('autoReload'), '      [' + shouldAutoReload + ']');
  gutil.log('   - ' + colorFunc('fixtures'), '        [' + fixtures + ']');
  gutil.log('   - ' + colorFunc('lint'), '            [' + shouldLint + ']');
  gutil.log('   - ' + colorFunc('lintfatal'), '       [' + isLintFatal + ']');
  gutil.log('----------------------------------');


}
function copyStatic() {
	return gulp.src(STATIC_PATH + '/**/*')
						.pipe(gulp.dest(BUILD_PATH + '/'));
}
function cleanAndBuild() {
	gutil.log(gutil.colors.blue('Starting CLEAN BUILD...'));

	gutil.log(gutil.colors.blue('  - clearing out all built files'));
  clean();

	gutil.log(gutil.colors.blue('  - copying all static files'));
	copyStatic();

	gutil.log(gutil.colors.blue('  - building'));
	build();
}
function build() {

	var sourcemapPath = SCRIPTS_PATH + '/' + OUTPUT_FILE + '.map';

	return browserify({
		entries: ENTRY_FILE,
		debug: true
	})
	.transform(babel)
	.bundle().on('error', function(error){
		             gutil.log(gutil.colors.red('[Build Error]', error.message));
                 notifier.notify({ title: 'Error', message: 'Build Error. Building failed.'});
                 this.emit('end');
	             })
						.on('end', function() {})

	.pipe(gulpif(!isProduction(), exorcist(sourcemapPath)))

	.pipe(source(OUTPUT_FILE))
	.pipe(buffer())
  .pipe(filesize())

	.pipe(gulpif(isProduction(), uglify()))
  .pipe(gulpif(isProduction(), filesize()))

	.pipe(gulp.dest(SCRIPTS_PATH));

}
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

	// Watches for changes in files inside the './static' folder. Also sets 'keepFiles' to true (see cleanAndBuild()).
	gulp.watch(STATIC_PATH + '/**/*', ['watch-static']).on('change', function() {
		keepFiles = true;
	});
}
function reloadBrowser() {

  if ( !shouldAutoReload || ! browserSync ) {
    gutil.log(gutil.colors.grey('Skipping browser auto-reload process'));
  }

	else {
		browserSync.reload();
	}
}
function lint() {

  // SKIP LINTING
  if ( ! shouldLint ) {
    gutil.log(gutil.colors.grey('Skipping lint process'));
    return true;
  }

  return gulp.src([SOURCE_PATH + '/**/*.js'])
    // eslint() attaches the lint output to the eslint property
    // of the file object so it can be used by other modules.
    .pipe(eslint())


    .pipe(plumber({
            errorHandler: function lintError(err) {
              beep([1, 1, 1]);

              // non-fatal lint - issue our own 'end' (will skip linter's fail)
              if ( ! isLintFatal ) {
                this.emit('end');
              }

              else {
                notifier.notify({ title: 'Error', message: 'Lint Error. Build canceled.'});
              }
            }
          }))

    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe(eslint.format())
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failAfterError last.
    .pipe(eslint.failAfterError());
}


/**
 *  TASKS
 */
gulp.task('lint',               lint);
gulp.task('log-environment',    logEnvironment);
gulp.task('clean-build',        ['log-environment', 'lint'], cleanAndBuild);
gulp.task('clean',              clean);
gulp.task('copy-static',        ['clean'], copyStatic);
gulp.task('watch-js',           ['build'], reloadBrowser);
gulp.task('watch-static',       ['copy-static'], reloadBrowser);

gulp.task('build',              ['log-environment', 'lint'], build);   // will default to dev builds
gulp.task('serve',              ['clean-build'], serve);
gulp.task('default',            ['serve']);
//gulp.task('default',            function (){
//  logBuildMode();
//});
