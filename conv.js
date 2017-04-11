var api_ai = require('apiai');
console.log('Using tkn : ', process.env.CLIENT_TKN)
var app = api_ai(process.env.CLIENT_TKN);
var uuid = require('node-uuid');
var active_session = {};
var online_users;
var bot_user = {
  username: 'Bot agent',
  userAvatar: 'avatar5.png',
  msg: 'migrate',
  hasMsg: true,
  ownMsg: false,
  hasFile: false,
  msgTime: '4:46 pm'
}

function sendResponse(msg, username) {
  if (online_users[username]) {
    if (msg) {
      bot_user.msg = msg;
      online_users[username].emit('new message', bot_user);
    }
  }
}

module.exports = function (socket, ol_users) {
  online_users = ol_users;
  online_users['bot_user'] = bot_user

  socket.on('new user', function (data, callback) {
    if (online_users[data.username]) {
      callback({
        success: false
      });
    } else {
      callback({
        success: true
      });
      socket.username = data.username;
      socket.userAvatar = data.userAvatar;
      online_users[data.username] = socket;
      sendResponse('Hi my name is ' + bot_user.username + '. May i know your good name ?', data.username)
    }
  });

  socket.on('send-message', function (data, callback) {
    console.log(data)
    if (active_session[data.username]) {
      askServer(data, active_session[data.username])
    } else {
      var session_id = uuid.v4()
      var options = {
        sessionId: session_id,
        username: data.username
      };
      active_session[data.username] = options
      askServer(data, options);
    }
  })
}

function askServer(data, options, cb) {
  var request = app.textRequest(data.msg, options);
  request.on('response', function (response) {
    if (response.status.code == 200) {
      console.log('Response question : ', response.result.fulfillment.speech)
      if (response.result.actionIncomplete) {
        sendResponse(response.result.fulfillment.speech, options.username)
      } else {
        console.log('completed', active_session[options.username]);
        console.log('ans', response.result.parameters)
        active_session[data.username].sol = response.result.parameters
        sendResponse(response.result.fulfillment.speech, options.username)
      }
    } else {
      console.log('Some thing went wrong', response);
      sendResponse('i am not feeling well !', options.username)
    }
  });
  request.on('error', function (error) {
    console.log('err', error);
  });
  request.end();
}
