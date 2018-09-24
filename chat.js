let id = null;
let outbound = [];
let inbound = [];
let message_graph;

function messageHandler(event) {
  let data = JSON.parse(event.data);

  if (data.type == "INIT") {
    id = data.payload.id;
		for (let msg of data.payload.history) {
			inbound.push(msg.payload);
		}
  }

  if (data.type == "MESSAGE") {
    inbound.push(data.payload);
  }
}

function sendLoop(ws) {
  while (outbound.length) {
    ws.send(JSON.stringify(outbound.shift()));
  }
}

function sendReply(id, message) {
	if (id === null) {
		console.log("Not yet initialized...");
  }

	outbound.push({
		id: selectedMessage.dataset.message_id,
		message: message
  });
}

let selectedMessage = null;
function selectMessage(div) {
	if (div === null || div === undefined) {
		div = selectedMessage;
	}
	if (selectedMessage) {
		selectedMessage.classList.remove("selected");
	}

  let input = document.getElementById("input");
  let placeholder = document.getElementById("input-placeholder");
	if (selectedMessage == div) {
		selectedMessage = null;
		input.classList.add("hidden");
		placeholder.classList.remove("hidden");
		return;
	}

	div.classList.add("selected");
	selectedMessage = div;
	input.classList.remove("hidden");
	placeholder.classList.add("hidden");
	input.focus();
}

// Returns a div from the chat data
function renderChat(data) {
  let div = document.createElement("div");
  div.dataset.message_id = data.message_id;
  div.dataset.user_id = data.user_id;
	div.classList.add("message");
  div.addEventListener('click', function() {
		selectMessage(div);
  });

	div.addEventListener('mouseout', function() {
		for (let node of message_graph.nodes()) {
			let old_div = message_graph.node(node);
			if (!old_div) {
				continue;
			}
      clearHighlight(old_div);
		}
	});
	div.addEventListener('mouseover', function() {
    highlightFromSource(div);
	});

  message_graph.setNode(data.message_id, div);
  message_graph.setEdge(data.reply_id, data.message_id);

  let title = document.createElement("div");
	title.classList.add("message-title");
  title.textContent = data.message_id;

  let body = document.createElement("div");
	body.classList.add("message-body");
  body.textContent = data.message;

  div.appendChild(title);
  div.appendChild(body);
  return div;
}

function renderLoop() {
  while (inbound.length) {
    let data = inbound.shift();
    let div = renderChat(data);
    let chats = document.getElementById("chats");
		chats.appendChild(div);
		chats.scrollTop = chats.scrollHeight;
  }
}

let numHighlightClasses = 0;
let highlightClassPrefix = "highlight";
function clearHighlight(div) {
  for (let i = 0; i < numHighlightClasses; i++) {
    div.classList.remove(highlightClassPrefix + "-" + i);
  }
}

function highlightFromSource(div) {
  let successors = 
    graphlib.alg.dijkstra(message_graph, div.dataset.message_id);
  let predecessor = 
    graphlib.alg.dijkstra(message_graph, div.dataset.message_id,
    function(){return 1;},
    message_graph.inEdges.bind(message_graph)
		);

	let nodes = successors;
	for (let key in predecessor) {
		if (key in nodes) {
			if (nodes[key].distance > predecessor[key].distance) {
				nodes[key] = predecessor[key];
			}
		} else {
			nodes[key] = predecessor[key];
		}
	}

  for (let k in nodes) {
    let node = nodes[k];
    let div = message_graph.node(k);
		if (div) {
			highlight(div, node.distance);
		}
  }
}

function highlight(div, num) {
  num = parseInt(num);
  if (num <= numHighlightClasses) {
    div.classList.add(highlightClassPrefix + "-" + num);
  }
}

function initHighlightClasses(num, base_color) {
  var style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML ='';
  for (let i = 0; i < num; ++i) {
		let opacity = (num - i) / num;
  	style.innerHTML += '.' + highlightClassPrefix + '-' +
				i + '{ background-color: '+
        'rgba('+
          base_color[0]+','+
          base_color[1]+','+
          base_color[2]+','+
          opacity +
				');\n' +
				'transition: background 0.2s;\n' +
        '}\n';
	}
  document.getElementsByTagName('head')[0].appendChild(style);
  numHighlightClasses = num;
}

function initDOM() {
  message_graph = new graphlib.Graph({ directed: true });
  let input = document.getElementById("input");
  input.addEventListener('keydown', function(e) {
    if (e.keyCode == 13) {
      e.preventDefault();
      sendReply(123, e.target.value.trim());
      e.target.value = "";
			// Clear selected message
			selectMessage();
    }
  });
  initHighlightClasses(3, [150,150,150]);
}

function main() {
	let ws = new WebSocket('ws://127.0.0.1:1337');
	ws.onopen = function(event) { }
	ws.onmessage = messageHandler;

  // Clear out queue periodically.
  setInterval(function() { sendLoop(ws); }, 200);
  setInterval(renderLoop, 200);

  initDOM();
}

window.addEventListener('load', main);
