
document.addEventListener('DOMContentLoaded', () => {
    // Back button handler
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.close();
        });
    }

    // Load documentation content
    const contentDiv = document.getElementById("content");
    if (contentDiv) {
        fetch("README.md")
            .then((response) => {
                if (!response.ok) throw new Error("Documentation file not found.");
                return response.text();
            })
            .then((text) => {
                if (window.marked) {
                    contentDiv.innerHTML = marked.parse(text);
                } else {
                    contentDiv.innerText = text;
                    console.warn("Marked.js not loaded, showing raw text.");
                }
            })
            .catch((err) => {
                contentDiv.innerHTML = `
                    <h2 style="color: #ff6b6b">Error Loading Documentation</h2>
                    <p>Could not load the local README.md file.</p>
                    <p>Technical details: ${err.message}</p>
                `;
            });
    }
});
