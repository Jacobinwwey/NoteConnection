// Initialize Graph
const container = document.getElementById('graph-container');
const width = container.clientWidth;
const height = container.clientHeight;

// Create SVG
const svg = d3.select("#graph-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
    }));

const g = svg.append("g");

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Data
const nodes = graphData.nodes.map(d => Object.create(d));
const links = graphData.edges.map(d => Object.create(d));

// Update stats
document.getElementById('node-count').innerText = nodes.length;
document.getElementById('edge-count').innerText = links.length;

// Simulation
const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(20)); // Avoid overlap

// Arrows for edges
svg.append("defs").selectAll("marker")
    .data(["end"])
    .enter().append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15) // Position of arrow
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#555");

// Render Links
const link = g.append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(links)
    .enter().append("path")
    .attr("class", "link")
    .attr("marker-end", "url(#arrow)");

// Render Nodes
const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .enter().append("g")
    .attr("class", "node")
    .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

// Node Circles (Color by degree)
const colorScale = d3.scaleSequential(d3.interpolateBlues)
    .domain([0, d3.max(nodes, d => d.inDegree + d.outDegree)]);

node.append("circle")
    .attr("r", 5)
    .attr("fill", d => colorScale(d.inDegree + d.outDegree));

// Node Labels
node.append("text")
    .attr("dx", 8)
    .attr("dy", ".35em")
    .text(d => d.label);

// Interactions
let transform = d3.zoomIdentity;

// Highlight Logic
node.on("mouseover", function(event, d) {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    // Dim all
    node.style("opacity", 0.1);
    link.style("opacity", 0.1);

    // Highlight current
    d3.select(this).style("opacity", 1).classed("highlight-main", true);

    // Find neighbors
    const connectedLinks = links.filter(l => l.source.id === d.id || l.target.id === d.id);
    const connectedNodeIds = new Set();
    connectedNodeIds.add(d.id);

    connectedLinks.forEach(l => {
        const isOutgoing = l.source.id === d.id;
        const isIncoming = l.target.id === d.id;

        if (mode === 'in' && !isIncoming) return;
        if (mode === 'out' && !isOutgoing) return;

        // Highlight Link
        const linkSel = link.filter(ld => ld === l);
        linkSel.style("opacity", 1)
               .classed("highlight-out", isOutgoing)
               .classed("highlight-in", isIncoming);

        // Add neighbor ID
        connectedNodeIds.add(l.source.id);
        connectedNodeIds.add(l.target.id);
    });

    // Highlight Neighbors
    node.filter(n => connectedNodeIds.has(n.id))
        .style("opacity", 1);

    // Tooltip
    tooltip.transition().duration(200).style("opacity", .9);
    tooltip.html(`
        <strong>${d.label}</strong><br/>
        In-Degree: ${d.inDegree}<br/>
        Out-Degree: ${d.outDegree}
    `)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 28) + "px");

}).on("mouseout", function() {
    // Reset styles
    node.style("opacity", 1).classed("highlight-main", false);
    link.style("opacity", 0.6)
        .classed("highlight-out", false)
        .classed("highlight-in", false);
    
    tooltip.transition().duration(500).style("opacity", 0);
});

// Simulation Tick
simulation.on("tick", () => {
    link.attr("d", d => {
        // Curved lines
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        // return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`; // Arc
        return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`; // Straight line for now (better for performance with many edges)
    });

    node.attr("transform", d => `translate(${d.x},${d.y})`);
});

// Search
document.getElementById('search-input').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    if (!term) {
        node.style("opacity", 1);
        return;
    }
    node.style("opacity", d => d.label.toLowerCase().includes(term) ? 1 : 0.1);
});

// Drag functions
function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}
