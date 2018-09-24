let id = null;
let outbound = [];
let inbound = [];
let message_graph;

function getMostRecentSelfMessage() {
    let topsort = graphlib.alg.topsort(message_graph).reverse();
    for (let chat of topsort) {
        let div = message_graph.node(chat);
        if (!div) {
            continue;
        }
        if (div.dataset.user_id === id) {
            return div;
        }
    }
    return message_graph.node(topsort[0]);
}

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
        clearAllHighlights();
        defaultHighlight();
    });
    div.addEventListener('mouseover', function() {
        clearAllHighlights();
        highlightFromSource(div);
    });

    message_graph.setNode(data.message_id, div);
    message_graph.setEdge(data.reply_id, data.message_id);

    let title = document.createElement("div");
    title.classList.add("message-title");

    let title_message_id = document.createElement("span");
    title_message_id.textContent = data.message_id;
    let title_user_id = document.createElement("span");
    title_user_id.style.fontStyle = 'italic';
    title_user_id.style.paddingRight = '5px';
    title_user_id.textContent = data.user_id;

    title.appendChild(title_user_id);
    title.appendChild(title_message_id);

    let body = document.createElement("div");
    body.classList.add("message-body");
    body.textContent = data.message;

    div.appendChild(title);
    div.appendChild(body);

    return div;
}

let scrollSlack = 1000;
function renderLoop() {
    let changed = false;
    while (inbound.length) {
        changed = true;
        let data = inbound.shift();
        let div = renderChat(data);
        let chats = document.getElementById("chats");
        chats.appendChild(div);
        
        //if (chats.scrollHeight - chats.scrollTop < scrollSlack) {
          chats.scrollTop = chats.scrollHeight;
        //}
    }

    // Refresh highlight
    if (changed) {
        defaultHighlight();
    }
}

function defaultHighlight() {
    if (selectedMessage) {
        highlightFromSource(selectedMessage);
    } else if (highlightSource) {
        highlightFromSource(highlightSource);
    } else {
        let lastSent = getMostRecentSelfMessage();
        if (lastSent) {
            highlightFromSource(lastSent);
        }
    }
}

let numHighlightClasses = 0;
let highlightClassPrefix = "highlight";


function clearAllHighlights() {
    for (let node of message_graph.nodes()) {
        let old_div = message_graph.node(node);
        if (!old_div) {
            continue;
        }
        clearHighlight(old_div);
    }
}

function clearHighlight(div) {
    for (let i = 0; i < numHighlightClasses; i++) {
        div.classList.remove(highlightClassPrefix + "-" + i);
    }
}

let highlightSource = null;

function highlightFromSource(div) {
    highlightSource = div;
    let nodes = graphlib.alg.dijkstra(
        message_graph,
        div.dataset.message_id,
        function() {
            return 1;
        },
        function(v) {
            let inEdges = message_graph.inEdges(v);
            let outEdges = message_graph.outEdges(v);
            let out = []
            if (inEdges) {
                out += inEdges;
            }
            if (outEdges) {
                out += outEdges;
            }
            return inEdges.concat(outEdges);
        }
    );

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

function hsvToRgb(h, s, v) {
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0:
            r = v, g = t, b = p;
            break;
        case 1:
            r = q, g = v, b = p;
            break;
        case 2:
            r = p, g = v, b = t;
            break;
        case 3:
            r = p, g = q, b = v;
            break;
        case 4:
            r = t, g = p, b = v;
            break;
        case 5:
            r = v, g = p, b = q;
            break;
    }

    return [r * 255, g * 255, b * 255];
}

function initHighlightClasses(num, base_color) {
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = '';
    for (let i = 0; i < num; ++i) {
        let hue = 0.5 + 0.5 * (num - i) / num;
        let opacity = (num - i) / num;
        base_color = hsvToRgb(hue, 1, 1);
        style.innerHTML += '.' + highlightClassPrefix + '-' +
            i + '{ border-left: 5px solid ' +
            'rgba(' +
            base_color[0] + ',' +
            base_color[1] + ',' +
            base_color[2] + ',' +
            opacity +
            ');\n' +
            'transition: border 0.2s;\n' +
            '}\n';
    }
    document.getElementsByTagName('head')[0].appendChild(style);
    numHighlightClasses = num;
}

function initDOM() {
    message_graph = new graphlib.Graph({
        directed: true
    });
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
    initHighlightClasses(10, [255, 0, 0]);
}

function main() {
    let ws = new WebSocket('ws://' + window.location.host);
    ws.onopen = function(event) {}
    ws.onmessage = messageHandler;

    // Clear out queue periodically.
    setInterval(function() {
        sendLoop(ws);
    }, 200);
    setInterval(renderLoop, 200);

    initDOM();
}

window.addEventListener('load', main);
