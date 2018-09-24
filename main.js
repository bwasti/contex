let WebSocketServer = require('websocket').server;
let http = require('http');
let path = require("path");
let fs = require("fs");

let server = http.createServer(function(request, response) {

	let filename = '';
	if (request.url == '/') {
		filename = path.join(process.cwd(), '/index.html');
	} else if (request.url == '/chat.js') {
		filename = path.join(process.cwd(), '/chat.js');
	}

	fs.exists(filename, function(exists) {

		fs.readFile(filename, "binary", function(err, file) {
			if(err) {        
				response.writeHead(500, {"Content-Type": "text/plain"});
				response.write(err + "\n");
				response.end();
				return;
			}

			response.writeHead(200);
			response.write(file, "binary");
			response.end();
		});
	});
});

server.listen(1337, function() { });

wsServer = new WebSocketServer({
	httpServer: server
});

// Rather than 0 so we can use false-y checks
let unique_integer = 1;

let clients = {};
let history = [
	{
		type: "MESSAGE",
		payload: {
			user_id: getUniqueInteger(),
			message_id: getUniqueInteger(),
			reply_id: 0,
			message: "first",
		}
	}
];


function getUniqueInteger() {
	return unique_integer++;
}

function getNumClients() {
	return Object.keys(clients).length;
}

/* Protocol:
 *
 * { 
 *   type: ... ,
 *   payload: ...
 * }
 *
 * type === "INIT"
 * - Setup for the chat.
 *  - id: Assigns ID to the user
 *  - history: Gives the user the chat history as list of messages
 *
 * type === "MESSAGE"
 * - An individual message
 *  - user_id: ID of user sending message
 *  - message_id: ID of message itself
 *  - reply_id: ID of message this one replies to
 *  - message: The message itself
 *
 */
wsServer.on('request', function(request) {
	let connection = request.accept(null, request.origin);
	let id = getUniqueInteger();
	clients[id] = connection;
	console.log("New client,", getNumClients(), "total");
	connection.sendUTF(JSON.stringify({
		type: "INIT",
    payload: {
			id: id,
			history: history,
    }
	}));


	connection.on('message', function(message) {
		if (message.type === 'utf8') {
			let data = JSON.parse(message.utf8Data);
			let outbound = null;
			if (data.message) {
				outbound = {
					type: "MESSAGE",
					payload: {
						user_id: id,
						message_id: getUniqueInteger(),
						reply_id: data.id,
						message: data.message.slice(0, 200),
					}
				}
				if (history.length > 100) {
					history = history.slice(1);
				}
				history.push(outbound);
			}
			if (outbound) {
        console.log("Sending messages");
				for (let client_id in clients) {
					clients[client_id].sendUTF(JSON.stringify(outbound));
        }
			}
		}
	});

	connection.on('close', function(connection) {
		delete clients[id];
		console.log("Client leaving,", getNumClients(), "total");
	});
});
