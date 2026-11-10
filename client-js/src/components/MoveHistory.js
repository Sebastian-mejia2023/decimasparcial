/**
 * Componente: Historial de Jugadas (MoveHistory)
 * 
 * ESPECIFICACIÓN DE REQUERIMIENTOS:
 * 1. Estructura del Componente (build())
 * 2. Estado Inicial / Vacío (renderEmpty())
 * 3. Actualización de Jugadas (update(moves))
 * 4. Obtención del Elemento DOM (getElement())
 */

export class MoveHistory {
    constructor() {
        this.element = document.createElement("div");
        this.listContainer = document.createElement("div");
        this.build();
    }

    build() {
        this.element.className = "moves-card";

        const header = document.createElement("div");
        header.className = "player-card-header";
        header.textContent = "Historial de Jugadas";

        this.listContainer.id = "moves-list";
        this.listContainer.className = "moves-list";

        this.element.appendChild(header);
        this.element.appendChild(this.listContainer);

        this.renderEmpty();
    }

    renderEmpty() {
        this.listContainer.replaceChildren();
        const emptyEl = document.createElement("em");
        emptyEl.textContent = "Sin jugadas aún";
        this.listContainer.appendChild(emptyEl);
    }

    update(moves) {
        if (!moves || moves.length === 0) {
            this.renderEmpty();
            return;
        }

        this.listContainer.replaceChildren();

        for (let i = 0; i < moves.length; i += 2) {
            const turnNumber = Math.floor(i / 2) + 1;
            const whiteMove = moves[i].moveNotation || "";
            const blackMove = (i + 1 < moves.length) ? (moves[i + 1].moveNotation || "") : "";

            const row = document.createElement("div");
            const strong = document.createElement("strong");
            strong.textContent = `${turnNumber}. `;
            row.appendChild(strong);

            const notationText = blackMove ? `${whiteMove} ${blackMove}` : whiteMove;
            row.appendChild(document.createTextNode(notationText));

            this.listContainer.appendChild(row);
        }

        this.listContainer.scrollTop = this.listContainer.scrollHeight;
    }

    getElement() {
        return this.element;
    }
}
