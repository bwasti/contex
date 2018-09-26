let WebSocket = require('ws');
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
            if (err) {
                response.writeHead(500, {
                    "Content-Type": "text/plain"
                });
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

server.listen(1337, function() {});

wsServer = new WebSocket.Server({
    server: server
});

// Rather than 0 so we can use false-y checks
let unique_integer = 1;

let clients = {};
let history = [];


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
let ip_rate_limit = {}
let rate_limit = 1000;
wsServer.on('connection', function(connection, request) {
    let ip =
        request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    if (!(ip in ip_rate_limit)) {
        console.log("Ignoring connection request from ", ip);
        ip_rate_limit = new Date(0);
    }
    if (((new Date()) - ip_rate_limit[ip]) < rate_limit) {
        return;
    }
    ip_rate_limit[ip] = new Date();

    //let connection = request.accept(null, request.origin);
    let id = getUniqueInteger();
    clients[id] = connection;
    console.log("New client ", ip, getNumClients(), "total");
    connection.send(JSON.stringify({
        type: "INIT",
        payload: {
            id: id,
            history: history,
        }
    }));


    connection.on('message', function(string_data) {
        if (((new Date()) - ip_rate_limit[ip]) < rate_limit) {
            console.log("Dropping message from ", ip);
            return;
        }
        ip_rate_limit[ip] = new Date();

        let data = JSON.parse(string_data);

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
            for (let client_id in clients) {
                clients[client_id].send(JSON.stringify(outbound));
            }
        }
    });

    connection.on('close', function(connection) {
        delete clients[id];
        console.log("Client leaving", ip, getNumClients(), "total");
    });
});
