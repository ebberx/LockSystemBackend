const ws = require('ws');
const logRepo = require('../repositories/logRepo.js');
const lockRepo = require('../repositories/lockRepo.js');
const userRepo = require('../repositories/userRepo.js');

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

    async Unlock(req, res) {
        const lockSerial = req.serial;
        const message = req.rpi_message;

        if (this.sockets.get(lockSerial) && this.sockets.get(lockSerial).readyState == 1) {
            this.sockets.get(lockSerial).send(message);
            return true;
        }

        const lock = await lockRepo.Get(res, req.body.lock_id);
        if (lock === undefined) return;

        const caller = await userRepo.Get(res, req.body.user_id);
        if (caller === undefined) return;

        const logRequest = {
            body: {
                lock: lock[0]._id,
                message: caller[0].email + " unsuccessfully tried to open lock " + lock[0].name,
            }
        }
        const log = await logRepo.Create(logRequest, res);
        if (log === undefined) return;
        
        res.status(400).json("Lock not online.");
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
