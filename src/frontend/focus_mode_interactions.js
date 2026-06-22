(function () {
    function normalizeText(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function resolveDoubleClickAction(input) {
        const currentAnchorId = normalizeText(input && input.currentAnchorId);
        const clickedNodeId = normalizeText(input && input.clickedNodeId);
        if (!clickedNodeId) {
            return {
                action: 'noop',
                clickedNodeId: '',
                currentAnchorId,
            };
        }
        if (currentAnchorId && currentAnchorId === clickedNodeId) {
            return {
                action: 'open-reader',
                clickedNodeId,
                currentAnchorId,
            };
        }
        return {
            action: 'switch-focus',
            clickedNodeId,
            currentAnchorId,
        };
    }

    window.NoteConnectionFocusModeInteractions = {
        resolveDoubleClickAction,
    };
}());
