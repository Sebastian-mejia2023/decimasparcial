
import { ChessRealtimeObserver } from "./chessRealtimeObserver.js";

/**
 * Servicio de comunicación RPC con ZeroC Ice sobre WebSockets.
 * Encapsula el ciclo de vida del Communicator, el proxy de ChessService
 * y la suscripción en tiempo real mediante ChessRealtimeObserver.
 */

export class ChessClientService {
    constructor() {
        this.Ice = (typeof window !== "undefined" && window.Ice) ? window.Ice : null;
        this.ChessApp = (typeof window !== "undefined" && window.ChessApp) ? window.ChessApp : null;
        this.communicator = null;
        this.service = null;
        this.realtimeObserver = null;
        this.isConnected = false;
        this.nickname = "";
        this.currentRoomCode = null;
        this.role = null;
        this.assignedColor = null;
    }

    validateRuntime() {
        if (!this.Ice && typeof window !== "undefined") {
            this.Ice = window.Ice;
        }
        if (!this.ChessApp && typeof window !== "undefined") {
            this.ChessApp = window.ChessApp;
        }
        if (!this.Ice || !this.ChessApp) {
            throw new Error("El runtime de ZeroC Ice o el contrato ChessApp no se encuentran disponibles.");
        }
    }

    async connect(host, port, nickname) {
        this.validateRuntime();

        if (this.communicator) {
            try {
                await this.communicator.destroy();
            } catch (ignored) {
            }
            this.communicator = null;
            this.service = null;
            this.isConnected = false;
        }

        const targetHost = (host && host.trim()) ? host.trim() : "127.0.0.1";
        const targetPort = port || 10002;
        this.nickname = (nickname && nickname.trim()) ? nickname.trim() : "Jugador";

        const initData = new this.Ice.InitializationData();
        initData.properties = this.Ice.createProperties();
        initData.properties.setProperty("Ice.MessageSizeMax", "2048");
        initData.properties.setProperty("Ice.ACM.Client.Timeout", "0");
        initData.properties.setProperty("Ice.ACM.Client.Heartbeat", "3");

        this.communicator = this.Ice.initialize(initData);

        const portNumber = Number(targetPort);
        const wsResource = portNumber === 80 ? " -r /ice" : "";
        const proxyStr = `ChessService:ws -h ${targetHost} -p ${targetPort}${wsResource}`;
        const base = this.communicator.stringToProxy(proxyStr);
        this.service = await this.ChessApp.ChessServicePrx.checkedCast(base);

        if (!this.service) {
            throw new Error(`No fue posible resolver ChessService en ${proxyStr}`);
        }

        this.realtimeObserver = new ChessRealtimeObserver(this.Ice, this.ChessApp);
        this.isConnected = true;
    }

    ensureConnected() {
        if (!this.isConnected || !this.service) {
            throw new Error("No hay conexión activa con el servidor de ajedrez.");
        }
    }

    async getLobbyData() {
        this.ensureConnected();
        const [rooms, leaderboard] = await Promise.all([
            this.service.getActiveRooms(),
            this.service.getLeaderboard()
        ]);
        return { rooms, leaderboard };
    }

    async createRoom(nickname) {
        this.ensureConnected();
        const nick = (nickname && nickname.trim()) ? nickname.trim() : this.nickname;
        this.nickname = nick;
        return await this.service.createRoom(nick);
    }

    async joinRoom(roomCode, nickname) {
        this.ensureConnected();
        const normalizedCode = (roomCode || "").trim().toUpperCase();
        const nick = (nickname && nickname.trim()) ? nickname.trim() : this.nickname;
        this.nickname = nick;

        const result = await this.service.joinRoom(normalizedCode, nick);
        this.currentRoomCode = normalizedCode;
        this.role = result.role;
        this.assignedColor = result.assignedColor;

        return result;
    }

    async subscribeToRoom(listeners = {}) {
        this.ensureConnected();
        if (!this.realtimeObserver) {
            this.realtimeObserver = new ChessRealtimeObserver(this.Ice, this.ChessApp);
        }
        await this.realtimeObserver.subscribe(
            this.communicator,
            this.service,
            this.currentRoomCode,
            this.nickname,
            listeners
        );
    }

    async makeMove(fromRow, fromCol, toRow, toCol) {
        this.ensureConnected();
        const fromPos = new this.ChessApp.Position(fromRow, fromCol);
        const toPos = new this.ChessApp.Position(toRow, toCol);
        return await this.service.makeMove(this.currentRoomCode, this.nickname, fromPos, toPos);
    }

    async resign() {
        this.ensureConnected();
        return await this.service.resign(this.currentRoomCode, this.nickname);
    }

    async leaveRoom() {
        if (this.realtimeObserver) {
            await this.realtimeObserver.unsubscribe(this.service, this.currentRoomCode, this.nickname);
        }
        if (this.service && this.currentRoomCode) {
            try {
                await this.service.leaveRoom(this.currentRoomCode, this.nickname);
            } catch (err) {
                console.warn("Error al abandonar la sala:", err);
            }
        }
        this.currentRoomCode = null;
        this.role = null;
        this.assignedColor = null;
    }
}
