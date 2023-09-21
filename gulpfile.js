const gulp = require('gulp'),
  glsl = require('gulp-glsl'),
  concat = require('gulp-concat'),
  terser = require('gulp-terser'),
  minify_html = require('gulp-minify-html'),
  webserver = require('gulp-webserver'),
  through = require('through2'),
  clean = require('gulp-clean')

var DEBUG = true

const srcDir = 'src/evil-glitch/src/'
const buildDir = 'src/evil-glitch/build/'

gulp.task('set-prod', cb => {
  DEBUG = false
  cb()
})

gulp.task('delete-build-folder', () => {
  return gulp.src(buildDir, { read: false, allowEmpty: true }).pipe(clean())
})

gulp.task('minify-glsl', () => {
  return gulp.src(srcDir + 'shaders/*')
    .pipe(glsl({ format: 'raw' }))
    .pipe(gulp.dest(buildDir))
})

gulp.task('to-var-glsl', () => {
  return gulp.src(buildDir + '*')
    .pipe(through.obj((file, enc, cb) => {
      const data = file.contents.toString()
      const varName = file.basename.substring(0, file.basename.indexOf('.')).toUpperCase()
      const content = `var ${varName} = '${data}';`
      // eslint-disable-next-line no-undef
      file.contents = Buffer.from(content)
      return cb(null, file)
    }))
    .pipe(gulp.dest(buildDir))
})

gulp.task('concat', () => {
  const prodFiles = !DEBUG ? [srcDir + 'env_prod.js'] : [srcDir + 'env_dev.js', srcDir + 'lib/stats.min.js']
  
  const libFiles = [
    'lib/geometry.js',
    'lib/webgl.js',
    'lib/jsfxr.js',
    'lib/audio.js',
    'lib/TinyMusic.js',
    'lib/font.js',
    'lib/ease.js',
    'lib/spatialhashing.js'
  ].map((v => srcDir + v))

  const shadersFiles = buildDir + '*'

  const gameFiles = [
    'setup.js',
    'colors.js',
    'effects.js',
    'clickEvents.js',
    'keyEvents.js',
    'music.js',
    'sounds.js',
    'gameState.js',
    'splash.js',
    'banner.js',
    'controllers.js',
    'buttons.js',
    'handleTrigger.js',
    'corruption.js',
    'enemies.js',
    'gameLoop.js',
    'post.js',
  ].map((v => srcDir + v))
  
  return gulp.src([
    srcDir + 'pre.js',
    ...prodFiles,
    ...libFiles,
    shadersFiles,
    ...gameFiles,
    srcDir + 'post.js'
  ])
    .pipe(concat('index.js'))
    .pipe(gulp.dest(buildDir))
})

gulp.task('minify-js', () => {
  return gulp.src(buildDir + 'index.js')
    .pipe(terser({
      mangle: { toplevel: true }
    }))
    .pipe(gulp.dest(buildDir))
})

gulp.task('copy-html', () => {
  return gulp.src(srcDir + 'index.html')
    .pipe(gulp.dest(buildDir))
})

gulp.task('minify-html', () => {
  return gulp.src(buildDir + 'index.html')
    .pipe(minify_html({ collapseWhitespace: true }))
    .pipe(gulp.dest(buildDir))
})

gulp.task('copy-dist', () => {
  return gulp.src([buildDir + 'index.html', buildDir + 'index.js'])
    .pipe(gulp.dest('./dist/target'))
})

gulp.task('build-debug', gulp.series(
  'delete-build-folder',
  'minify-glsl',
  'to-var-glsl',
  'concat',
  'copy-html'
))

gulp.task('build-release', gulp.series(
  'set-prod',
  'delete-build-folder',
  'minify-glsl',
  'to-var-glsl',
  'concat',
  'minify-js',
  'copy-html',
  'minify-html',
  'copy-dist'
))

gulp.task('serve', () => {
  return gulp.src(buildDir)
    .pipe(webserver({
      debugger: { enable: false },
      open: true,
      livereload: true
    }))
})

gulp.task('watch', () => {
  gulp.watch(srcDir, gulp.series('build-debug'))
})

gulp.task('run-debug', gulp.series('build-debug', 'serve', 'watch'))

gulp.task('default', gulp.series('run-debug'))
