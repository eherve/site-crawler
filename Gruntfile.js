'use strict';

var RELOAD_WAITING_TIMEOUT = 1500;
var FILES = {
  jshint: {
    all: [
      '*.js', 'routes/{,*/}*.js', 'models/{,*/}*.js', 'tools/{,*/}*.js',
      'errors/{,*/}*.js', 'public/{,*/}*.js', 'bin/www', 'upgrades/{,*/}*.js'
    ],
    server: [
      '*.js', 'routes/{,*/}*.js', 'models/{,*/}*.js', 'tools/{,*/}*.js',
      'errors/{,*/}*.js', 'bin/www', 'upgrades/{,*/}*.js'
    ]
  },
  watch: {
    all: [
      '*.js', 'config/*.{json}', 'routes/{,*/}*.js', 'models/{,*/}*.js',
      'tools/{,*/}*.js', 'errors/{,*/}*.js', 'public/{,*/}*.js', 'bin/www',
      'upgrades/{,*/}*.js'
    ],
    server: [
      '*.js', 'config/{,*/}*.json', 'routes/{,*/}*.js', 'models/{,*/}*.js',
      'tools/{,*/}*.js', 'errors/{,*/}*.js', 'bin/www', 'upgrades/{,*/}*.js'
    ]
  }
};

module.exports = function(grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Project configuration
  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),
    config: grunt.file.readJSON('config/application.json'),
    port: '<%= config.port %>' || process.env.PORT || 9000,
    dport: '<%= config.dport %>' || 5858,

		// Npm and Bower auto install
		auto_install: { // jshint ignore:line
			local: {},
			options: {
				bower: false
			}
		},

    // Watches files for changes and runs tasks based on the changed files
    watch: {
      all: {
        files: FILES.watch.all,
        tasks: [ 'jshint:all', 'watch:all' ],
        options: { }
      },
      server: {
        files: FILES.watch.server,
        tasks: [ 'express:dev', 'wait', 'newer:jshint:server' ],
        options: {
          livereload: true,
          // Without this option specified express won't be reloaded
          nospawn: true
        }
      }
    },

    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: {
        src: FILES.jshint.all
      },
      server: {
        src: FILES.jshint.server
      }
    },

    // Open
    open: {
      server: {
        url: 'http://localhost:<%=port%>'
      }
    },

    // Server Express
    express: {
      options: {
        script: 'bin/www', port: '<%=port%>',
        output: '.*Express server listening on port [0-9]+.*', debug: false
      },
      dev: {
        options: { debug: true, 'node_env': 'development' }
      },
      prod: {
        options: { 'node_env': 'production' }
      }
    }

  });

  // Utils tasks
  grunt.registerTask('wait',
    'Delaying livereload until after server has restarted',
    function () {
      // Used for delaying livereload until after server has restarted
      grunt.log.ok('Waiting for server reload...');
      var done = this.async();
      setTimeout(function () {
        grunt.log.writeln('Done waiting!');
        done();
      }, RELOAD_WAITING_TIMEOUT);
    }
  );


  grunt.registerTask('express-keepalive',
    'Keep grunt running',
    function () {
      this.async();
    }
  );

  // Tasks
  grunt.registerTask('default', [
		'auto_install',
    'jshint:all',
    'watch:all'
  ]);

  grunt.registerTask('debug', [
		'auto_install',
    'express:dev',
    'watch:server'
  ]);

  grunt.registerTask('serve', [
		'auto_install',
    'express:prod',
    'express-keepalive'
  ]);

};

