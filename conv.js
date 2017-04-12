var api_ai = require('apiai');
var EventEmitter = require('events');
console.log('Using tkn : ', process.env.CLIENT_TKN)
var app = api_ai(process.env.CLIENT_TKN);
var uuid = require('node-uuid');
var search_rackspace = require('./search_rack');
var active_session = {};
var bot_user = {
  username: 'Bot agent',
  userAvatar: 'avatar5.png',
  msg: 'migrate',
  hasMsg: true,
  msgTime: '4:46 pm'
}
var conv_manager;
var response_handler = new EventEmitter();

function ConversationManager(ios) {
  var self = this;
  self.online_users = {
    'bot_user': bot_user
  }
  self.ios = ios;
  self.online_agent_users = [];

}

ConversationManager.prototype.sendResponse = function (msg, username) {
  if (this.online_users[username]) {
    if (msg) {
      bot_user.msg = msg;
      this.online_users[username].emit('new message', bot_user);
    }
  }
}

ConversationManager.prototype.addAgent = function (socket) {
  this.online_users[socket.username] = socket;
  socket.join('all_user');
  this.bot_user = this.online_users['bot_user'];
  delete this.online_users['bot_user'];
  this.publishOnlineMember();
}

ConversationManager.prototype.addUserToChat = function (socket) {
  var self = this;
  socket.on('new user', function (data, callback) {
    if (self.online_users[data.username]) {
      callback({
        success: false
      });
    } else {
      callback({
        success: true
      });
      socket.username = data.username;
      socket.userAvatar = data.userAvatar;
      if (data.username.toLowerCase().indexOf('agent') == 0) {
        socket.isAgent = true;
        socket.room_id = Object.keys(socket.rooms)[0]
        socket.leave(socket.room_id);
        self.online_agent_users.push(socket);
        // self.online_users[data.username] = socket;
        self.sendResponse('You will be summoned when needed!', socket.username)
      } else {
        socket.isAgent = false;
        socket.join('all_user');
        self.online_users[data.username] = socket;
        self.sendResponse('Hi my name is ' + bot_user.username + '. May i know your good name ?', data.username)
      }
    }
  });

  socket.on('send-message', function (data, callback) {
    if (data.msg.indexOf('Thank you!!!') == 0) {
      console.log('bot comes in')
      self.ios.to('all_user').emit('new message', data);
      self.online_users[data.username].leave('all_user');
      self.online_agent_users.push(self.online_users[data.username])
      delete self.online_users[data.username];

      self.online_users['bot_user'] = self.bot_user;
      bot_user.msg = 'Is there anything else I can help you with.';
      self.ios.to('all_user').emit('new message', bot_user);
      self.publishOnlineMember();
      return;
    }
    if (!self.online_users['bot_user']) {
      console.log('bot cant say anything')
      return;
    }
    console.log('bot processing...')
    if (active_session[data.username]) {
      self.askServer(data, active_session[data.username])
    } else {
      var session_id = uuid.v4()
      var options = {
        sessionId: session_id,
        username: data.username
      };
      active_session[data.username] = options
      self.askServer(data, options);
    }
  })
  // sending online members list
  socket.on('get-online-members', function () {
    self.publishOnlineMember()
  });
  // sending new message
  socket.on('send-message', function (data, callback) {
    if (self.online_users[data.username]) {
      if (data.hasMsg) {
        self.ios.to('all_user').emit('new message', data);
        callback({
          success: true
        });
      } else if (data.hasFile) {
        if (data.istype == "image") {
          socket.emit('new message image', data);
          callback({
            success: true
          });
        } else if (data.istype == "music") {
          socket.emit('new message music', data);
          callback({
            success: true
          });
        } else if (data.istype == "PDF") {
          socket.emit('new message PDF', data);
          callback({
            success: true
          });
        }
      } else {
        callback({
          success: false
        });
      }
    }
  });

  // disconnect user handling
  socket.on('disconnect', function () {
    delete self.online_users[socket.username];
    var online_member = [];
    x = Object.keys(self.online_users);
    for (var k = 0; k < x.length; k++) {
      socket_id = x[k];
      socket_data = self.online_users[socket_id];
      temp1 = {
        "username": socket_data.username,
        "userAvatar": socket_data.userAvatar,
      };
      online_member.push(temp1);
    }
    self.ios.to('all_user').emit('online-members', online_member);
  });
}

ConversationManager.prototype.publishOnlineMember = function () {
  var self = this;
  i = Object.keys(self.online_users);
  var online_member = [];
  for (var j = 0; j < i.length; j++) {
    socket_id = i[j];
    socket_data = self.online_users[socket_id];
    temp1 = {
      "username": socket_data.username,
      "userAvatar": socket_data.userAvatar
    };
    online_member.push(temp1);
  }
  self.ios.to('all_user').emit('online-members', online_member);

}

ConversationManager.prototype.askServer = function (data, options) {
  var self = this;
  var request = app.textRequest(data.msg, options);
  request.on('response', function (response) {
    console.log('Match score : ', response.result.score);
    if (response.status.code == 200) {
      console.log('Response question : ', response.result.fulfillment.speech)
      if (response.result.actionIncomplete) {
        self.sendResponse(response.result.fulfillment.speech, options.username)
      } else {
        // processed with action if it completed or throw the next question
        console.log('User completed : ', active_session[options.username])
        console.log('Ans : ', response.result.parameters)
        console.log('Action req : ', response.result.action)
        if (response.result.fulfillment.speech) {
          self.sendResponse(response.result.fulfillment.speech, options.username)
        }
        if (response.result.action) {
          delete active_session[data.username]
          response_handler.emit(response.result.action, response.result.parameters, options.username)
        }
      }
    } else {
      console.log('Some thing went wrong', response);
      self.sendResponse('i am not feeling well !', options.username)
    }
  });
  request.on('error', function (error) {
    console.log('err', error);
  });
  request.end();
}



response_handler.on('intro', function (data, username) {
  console.log('intro', data)
})

response_handler.on('general_search', function (data, username) {
  console.log('general_search',username, data)
  search_rackspace.general_search(data.search_query, function (response) {
    if (response && response.length > 0) {
      conv_manager.sendResponse("Here is what I found...", username)
      for (var i = 0; i < response.length; i++) {
        var res_msg = response[i].title + '\n'
        res_msg += response[i].desc + '\n'
        res_msg += 'More info on : ' + response[i].link
        conv_manager.sendResponse(res_msg, username)
      }

    }
  })
})
response_handler.on('migrate', function (data, username) {
  console.log('help migrate', data)
  var agent_socket = conv_manager.online_agent_users.pop()
  conv_manager.addAgent(agent_socket);
})

response_handler.on('support', function (data, username) {
  console.log('support',username, data)
  search_rackspace.general_search(data.search_query, function (response) {
    console.log(response)
    if (response && response.length > 0) {
      conv_manager.sendResponse("Here is what I found...", username)
      for (var i = 0; i < response.length; i++) {
        var res_msg = response[i].title + '\n'
        res_msg += response[i].desc + '\n'
        res_msg += 'More info on : ' + response[i].link
        conv_manager.sendResponse(res_msg, username)
      }
    }
  })
})
module.exports = function (ios) {
  conv_manager = new ConversationManager(ios)
  ios.on('connection', function (socket) {
    conv_manager.addUserToChat(socket);
  });

  return conv_manager;
}
