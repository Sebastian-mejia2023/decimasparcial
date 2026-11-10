import { getPieceGlyph } from "../services/chessRulesHelper.js";

/**
 * Componente del Tablero de Ajedrez 8x8 manipulando directamente el DOM.
 */
export class ChessBoard {
    constructor(onTileClicked) {
        this.onTileClicked = onTileClicked;
        this.element = document.createElement("div");
        this.boardGrid = document.createElement("div");
        this.tiles = [];

        this.build();
    }

    build() {
        this.element.className = "board-wrapper";
        this.boardGrid.id = "chessboard";
        this.boardGrid.className = "chessboard";

        for (let r = 0; r < 8; r++) {
            const rowTiles = [];
            for (let c = 0; c < 8; c++) {
                const tile = document.createElement("div");
                const isLight = (r + c) % 2 === 0;
                tile.className = `tile ${isLight ? "light" : "dark"}`;
                tile.dataset.row = String(r);
                tile.dataset.col = String(c);

                tile.addEventListener("click", () => {
                    if (this.onTileClicked) {
                        this.onTileClicked(r, c);
                    }
                });

                this.boardGrid.appendChild(tile);
                rowTiles.push(tile);
            }
            this.tiles.push(rowTiles);
        }

        this.element.appendChild(this.boardGrid);
    }

    /**
     * Renderiza el estado completo del tablero de ajedrez en las casillas del DOM.
     * 
     * ESPECIFICACIÓN DE REQUERIMIENTOS:
     * 
     * Parámetros:
     * - gameState: Objeto de estado remoto de ZeroC Ice (tipo GameState de Slice).
     *   * gameState.board: Matriz de 8x8 con instancias de ChessPiece (piece.type, piece.color).
     *   * gameState.moves: Arreglo de jugadas MoveHistoryItem[] (para identificar la última jugada).
     * - selectedSquare: Objeto { row, col } de la casilla actualmente seleccionada por el usuario (o null).
     * - legalMoves: Arreglo de objetos { row, col } con los destinos legales calculados (o arreglo vacío).
     */
    render(gameState, selectedSquare, legalMoves = []) {
        // 1. Validación previa: abortar si no hay estado o matriz de tablero
        if (!gameState || !gameState.board) {
            return;
        }

        // 2. Identificación de origen y destino de la última jugada realizada
        let lastFrom = null;
        let lastTo = null;
        if (gameState.moves && gameState.moves.length > 0) {
            const lastMove = gameState.moves[gameState.moves.length - 1];
            if (lastMove && lastMove.fromPos && lastMove.toPos) {
                lastFrom = lastMove.fromPos;
                lastTo = lastMove.toPos;
            }
        }

        // 3. Actualización de las 64 casillas del tablero
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const tile = this.tiles[r][c];
                const piece = gameState.board[r][c];
                const isLight = (r + c) % 2 === 0;

                // Restablecer clase base y limpiar contenido anterior
                tile.className = `tile ${isLight ? "light" : "dark"}`;
                tile.replaceChildren();

                // Resaltar casillas involucradas en la última jugada
                const isLastFrom = lastFrom && lastFrom.row === r && lastFrom.col === c;
                const isLastTo = lastTo && lastTo.row === r && lastTo.col === c;
                if (isLastFrom || isLastTo) {
                    tile.classList.add("last-move");
                }

                // Resaltar casilla actualmente seleccionada
                if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) {
                    tile.classList.add("selected");
                }

                // Dibujar pieza si la casilla no está vacía
                const hasPiece = piece && piece.type && piece.type._name !== "PIECEEMPTY";
                if (hasPiece) {
                    const pieceEl = document.createElement("span");
                    const isWhite = piece.color && piece.color._name === "COLORWHITE";
                    pieceEl.className = isWhite ? "piece-white" : "piece-black";
                    pieceEl.textContent = getPieceGlyph(piece);
                    tile.appendChild(pieceEl);
                }

                // Indicadores de movimiento sugerido
                const isLegal = legalMoves && legalMoves.some(m => m.row === r && m.col === c);
                if (isLegal) {
                    const indicator = document.createElement("div");
                    indicator.className = hasPiece ? "capture-ring" : "move-dot";
                    tile.appendChild(indicator);
                }
            }
        }
    }

    getElement() {
        return this.element;
    }
}
