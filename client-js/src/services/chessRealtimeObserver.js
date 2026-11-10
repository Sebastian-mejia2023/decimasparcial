/**
 * Gestor de actualizaciones en tiempo real para el cliente Web mediante
 * Conexiones Bidireccionales (BiDir) sobre WebSockets en ZeroC Ice.
 * Implementa el servant ChessObserver en el navegador sin usar polling.
 */

export class ChessRealtimeObserver {
    constructor(Ice, ChessApp) {
        this.Ice = Ice;
        this.ChessApp = ChessApp;
        this.adapter = null;
        this.identity = null;
        this.onStateChangedCallback = null;
        this.onGameFinishedCallback = null;
    }

    /**
     * Crea el servant de ChessObserver, configura el ObjectAdapter bidireccional
     * sobre la conexión WebSocket activa y registra el observador en la sala.
     */
    async subscribe(communicator, servicePrx, roomCode, nickname, { onStateChanged, onGameFinished } = {}) {
        // 1. Limpiar cualquier adaptador previo y almacenar los callbacks
        await this.cleanupAdapter();
        this.onStateChangedCallback = onStateChanged || null;
        this.onGameFinishedCallback = onGameFinished || null;

        // 2. Definir e instanciar el servant que implementa los callbacks push de Slice
        const self = this;
        class WebChessObserverServant extends this.ChessApp.ChessObserver {
            onGameStateChanged(newState, _current) {
                if (self.onStateChangedCallback) {
                    self.onStateChangedCallback(newState);
                }
            }

            onGameFinished(finalState, winnerNickname, pointsDelta, _current) {
                if (self.onGameFinishedCallback) {
                    self.onGameFinishedCallback(finalState, winnerNickname, pointsDelta);
                }
            }
        }

        const servant = new WebChessObserverServant();

        // 3. Crear ObjectAdapter sin endpoints, registrar el servant bajo una identidad única UUID y activarlo
        this.adapter = await communicator.createObjectAdapter("");
        this.identity = new this.Ice.Identity(this.Ice.generateUUID(), "ChessObserver");
        this.adapter.add(servant, this.identity);
        await this.adapter.activate();

        // 4. Obtener la conexión WebSocket activa y asociarle el adaptador local (BiDir)
        const connection = await servicePrx.ice_getConnection();
        await connection.setAdapter(this.adapter);

        // 5. Crear el proxy local no tipado, castearlo a ChessObserverPrx y registrarlo en el servidor
        const basePrx = this.adapter.createProxy(this.identity);
        const observerPrx = this.ChessApp.ChessObserverPrx.uncheckedCast(basePrx);

        await servicePrx.registerObserver(roomCode, nickname, observerPrx);
    }

    /**
     * Desvincula el observador de la sala en el servidor y limpia el adaptador local.
     */
    async unsubscribe(servicePrx, roomCode, nickname) {
        this.onStateChangedCallback = null;
        this.onGameFinishedCallback = null;

        if (servicePrx && roomCode && nickname) {
            try {
                await servicePrx.unregisterObserver(roomCode, nickname);
            } catch (err) {
                console.warn("Error desregistrando observador en el servidor:", err);
            }
        }

        await this.cleanupAdapter();
    }

    async cleanupAdapter() {
        if (this.adapter) {
            try {
                if (this.identity) {
                    this.adapter.remove(this.identity);
                }
                await this.adapter.destroy();
            } catch (err) {
                console.warn("Error destruyendo adaptador previo:", err);
            } finally {
                this.adapter = null;
                this.identity = null;
            }
        }
    }
}
