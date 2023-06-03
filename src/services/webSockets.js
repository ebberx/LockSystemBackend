const ws = require('ws');

class WebSocketService {
    constructor(server) {
        this.wss = new ws.Server({ server: server });
        this.sockets = new Map();

        this.wss.on('connection', (_ws, req) => {
            const id = getWsId(req);
            this.sockets.set(id, _ws);
            console.log("Lock: " + id + " connected.");

            _ws.on('close', () => {
                this.sockets.delete(id);
                console.log("Lock: " + id + " disconnected.");
            })
        })
    }

    Unlock(lockSerial, message) {
        if (this.sockets.get(lockSerial) && this.sockets.get(lockSerial).readyState == 1) {
            this.sockets.get(lockSerial).send(message);
            return true;
        }
        
        return false;
    }
}

function getWsId(req) {
    let id = "test";
    if (req.headers["lockid"] != undefined) {
        id = req.headers["lockid"].toString();
    }
    return id;
}

module.exports = WebSocketService;