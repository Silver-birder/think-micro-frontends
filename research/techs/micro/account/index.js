/**
 * Module dependencies
 */

var path = require('path')
var assert = require('assert')
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var session = require('express-session')
var connect = require('connect')

// get micromono instance
var micromono = require('/opt/micromono')

// get passport
var passport = require('./passport')

// generate passport authentication function
var passportAuth = passport.authenticate('local', {
  successRedirect: '/account/protected',
  failureRedirect: '/account/login',
  failureFlash: false
})

function isAuthenticated(req, res) {
  if (req.isAuthenticated()) {
    return true
  } else {
    res.redirect('/account/login')
    return false
  }
}

// setup a dedicated connect middleware for parsing data and session,
// so we can reuse it in the `auth` middleware and the express app.
var connectAuth = connect()

connectAuth.use(bodyParser.json())
connectAuth.use(bodyParser.urlencoded({
  extended: false
}))

connectAuth.use(cookieParser())
connectAuth.use(session({
  secret: 'micromono',
  resave: true,
  saveUninitialized: true
}))

connectAuth.use(passport.initialize())
connectAuth.use(passport.session())

/**
 * Account service
 */
var Account = module.exports = {
  middleware: {
    auth: function() {
      return function(req, res, next) {
        if (req.isAuthenticated()) {
          next()
        } else {
          connectAuth(req, res, function() {
            if (isAuthenticated(req, res)) {
              next()
            }
          })
        }
      }
    }
  },

  use: {
    // tell micromono to use `layout` middleware at the server side
    // for request url matching `/account/:page`.
    'layout': '/account/:page'
  },

  /**
   * Route definition property
   * @type {Object}
   */
  route: {
    /**
     * Example protected page
     */
    'get::/account/protected': function protectedPage(req, res) {
      if (isAuthenticated(req, res)) {
        res.render('hello', {
          name: req.user.username
        })
      }
    },

    'post::/logout': function logout(req, res) {
      req.logout()
      res.redirect('/account/login')
    },

    'get::/account/login': function login(req, res) {
      res.render('login')
    },

    /**
     * Login form handler
     */
    'post::/account/login': [passportAuth, function loginOkay(req, res) {
      res.redirect('/account/protected')
    }],

    '/account/exit': function(req, res) {
      res.send('ok')
      setTimeout(function() {
        process.exit(0)
      }, 1000)
    }
  },

  init: function(app) {
    // attach the connect auth middleware to our local express app
    app.use(connectAuth)

    // setup template engine
    app.set('views', path.join(__dirname, './view'))
    app.set('view engine', 'jade')

    return true
  },

  getUserById: function(id, callback) {
    if (id === 1) {
      callback({
        id: 1,
        username: 'micromono',
        password: '123456'
      })
    } else {
      callback(null)
    }
  },



  api: {
    getUserById: function(id, callback) {
      this.getUserById(id, callback)
    },
    getMultiArgs: function (arg1, arg2, callback) {
      assert.equal(arg1, 1)
      assert.equal(arg2.key, 'value')
      callback(null, [1, '2', Buffer('hello')])
    }
  }
}

// Start the service if this is the main file
if (require.main === module) {
  micromono.startService(Account)
}
