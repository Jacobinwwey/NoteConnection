use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet, VecDeque};
use std::f64::consts::PI;

thread_local! {
    static LAST_RESULT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LayoutInput {
    nodes: Vec<LayoutNodeInput>,
    config: Option<LayoutConfigInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LayoutNodeInput {
    id: String,
    in_degree: Option<u32>,
    out_degree: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LayoutConfigInput {
    repulsion: Option<f64>,
    distance: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LayoutOutput {
    nodes: Vec<LayoutNodeOutput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LayoutNodeOutput {
    id: String,
    x: f64,
    y: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BetweennessInput {
    node_ids: Vec<String>,
    adjacency: HashMap<String, Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BetweennessOutput {
    values: HashMap<String, f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CyclesInput {
    node_ids: Vec<String>,
    adjacency: HashMap<String, Vec<String>>,
    limit: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CyclesOutput {
    cycles: Vec<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RanksInput {
    node_ids: Vec<String>,
    adjacency: HashMap<String, Vec<String>>,
    in_degrees: HashMap<String, i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RanksOutput {
    ranks: HashMap<String, u32>,
}

#[derive(Debug)]
struct DfsFrame {
    id: String,
    neighbors: Vec<String>,
    index: usize,
}

fn with_input_bytes(input_ptr: *const u8, input_len: usize) -> Option<Vec<u8>> {
    if input_ptr.is_null() || input_len == 0 {
        return None;
    }
    let bytes = unsafe { std::slice::from_raw_parts(input_ptr, input_len) };
    Some(bytes.to_vec())
}

fn set_last_result_bytes(bytes: Vec<u8>) -> usize {
    LAST_RESULT.with(|buffer| {
        let mut borrowed = buffer.borrow_mut();
        *borrowed = bytes;
        borrowed.as_ptr() as usize
    })
}

fn set_last_result_json<T: Serialize>(payload: &T) -> usize {
    match serde_json::to_vec(payload) {
        Ok(bytes) => set_last_result_bytes(bytes),
        Err(_) => set_last_result_bytes(Vec::new()),
    }
}

fn set_empty_result() -> usize {
    set_last_result_bytes(Vec::new())
}

fn compute_layout_payload(input: LayoutInput) -> LayoutOutput {
    let count = input.nodes.len().max(1);
    let distance = input
        .config
        .as_ref()
        .and_then(|cfg| cfg.distance)
        .unwrap_or(100.0)
        .abs()
        .max(32.0);
    let repulsion = input
        .config
        .as_ref()
        .and_then(|cfg| cfg.repulsion)
        .unwrap_or(-500.0)
        .abs();

    let radius = distance + (repulsion.sqrt() * 0.35);
    let nodes = input
        .nodes
        .iter()
        .enumerate()
        .map(|(index, node)| {
            let angle = (index as f64 / count as f64) * 2.0 * PI;
            let degree_bias = (node.in_degree.unwrap_or(0) + node.out_degree.unwrap_or(0)) as f64;
            let offset = degree_bias * 0.25;
            LayoutNodeOutput {
                id: node.id.clone(),
                x: (radius + offset) * angle.cos(),
                y: (radius + offset) * angle.sin(),
            }
        })
        .collect::<Vec<_>>();

    LayoutOutput { nodes }
}

fn compute_betweenness_values(input: BetweennessInput) -> HashMap<String, f64> {
    let node_ids = input.node_ids;
    let adjacency = input.adjacency;
    let mut cb: HashMap<String, f64> = HashMap::new();
    for node_id in &node_ids {
        cb.insert(node_id.clone(), 0.0);
    }

    for source in &node_ids {
        let mut stack: Vec<String> = Vec::with_capacity(node_ids.len());
        let mut predecessors: HashMap<String, Vec<String>> = HashMap::new();
        let mut sigma: HashMap<String, f64> = HashMap::new();
        let mut distance: HashMap<String, i64> = HashMap::new();

        for node_id in &node_ids {
            predecessors.insert(node_id.clone(), Vec::new());
            sigma.insert(node_id.clone(), 0.0);
            distance.insert(node_id.clone(), -1);
        }

        sigma.insert(source.clone(), 1.0);
        distance.insert(source.clone(), 0);

        let mut queue: VecDeque<String> = VecDeque::new();
        queue.push_back(source.clone());

        while let Some(v) = queue.pop_front() {
            stack.push(v.clone());
            let v_distance = *distance.get(&v).unwrap_or(&-1);
            let v_sigma = *sigma.get(&v).unwrap_or(&0.0);

            for w in adjacency.get(&v).cloned().unwrap_or_default() {
                if !distance.contains_key(&w) {
                    continue;
                }

                if *distance.get(&w).unwrap_or(&-1) < 0 {
                    distance.insert(w.clone(), v_distance + 1);
                    queue.push_back(w.clone());
                }

                if *distance.get(&w).unwrap_or(&-1) == v_distance + 1 {
                    let current_sigma = *sigma.get(&w).unwrap_or(&0.0);
                    sigma.insert(w.clone(), current_sigma + v_sigma);
                    predecessors.entry(w.clone()).or_default().push(v.clone());
                }
            }
        }

        let mut delta: HashMap<String, f64> = HashMap::new();
        for node_id in &node_ids {
            delta.insert(node_id.clone(), 0.0);
        }

        while let Some(w) = stack.pop() {
            let w_sigma = *sigma.get(&w).unwrap_or(&0.0);
            for v in predecessors.get(&w).cloned().unwrap_or_default() {
                if w_sigma == 0.0 {
                    continue;
                }
                let v_sigma = *sigma.get(&v).unwrap_or(&0.0);
                let w_delta = *delta.get(&w).unwrap_or(&0.0);
                let v_delta = *delta.get(&v).unwrap_or(&0.0);
                delta.insert(v.clone(), v_delta + (v_sigma / w_sigma) * (1.0 + w_delta));
            }

            if w != *source {
                let current = *cb.get(&w).unwrap_or(&0.0);
                cb.insert(w.clone(), current + *delta.get(&w).unwrap_or(&0.0));
            }
        }
    }

    cb
}

fn compute_cycles_values(input: CyclesInput) -> Vec<Vec<String>> {
    let CyclesInput {
        node_ids,
        adjacency,
        limit,
    } = input;
    let normalized_limit = limit.unwrap_or(0);

    let mut visited: HashSet<String> = HashSet::new();
    let mut on_path: HashSet<String> = HashSet::new();
    let mut path: Vec<String> = Vec::new();
    let mut cycles: Vec<Vec<String>> = Vec::new();

    for node_id in node_ids {
        if normalized_limit > 0 && cycles.len() >= normalized_limit {
            break;
        }
        if visited.contains(&node_id) {
            continue;
        }

        let mut stack: Vec<DfsFrame> = Vec::new();
        visited.insert(node_id.clone());
        on_path.insert(node_id.clone());
        path.push(node_id.clone());
        stack.push(DfsFrame {
            id: node_id.clone(),
            neighbors: adjacency.get(&node_id).cloned().unwrap_or_default(),
            index: 0,
        });

        while !stack.is_empty() {
            let should_pop = match stack.last() {
                Some(frame) => frame.index >= frame.neighbors.len(),
                None => false,
            };

            if should_pop {
                if let Some(frame) = stack.pop() {
                    on_path.remove(&frame.id);
                }
                path.pop();
                continue;
            }

            let Some(frame) = stack.last_mut() else {
                continue;
            };
            let Some(neighbor_id) = frame.neighbors.get(frame.index).cloned() else {
                frame.index += 1;
                continue;
            };
            frame.index += 1;

            if on_path.contains(&neighbor_id) {
                if let Some(cycle_start_index) = path.iter().position(|id| id == &neighbor_id) {
                    let mut cycle = path[cycle_start_index..].to_vec();
                    cycle.push(neighbor_id.clone());
                    cycles.push(cycle);
                    if normalized_limit > 0 && cycles.len() >= normalized_limit {
                        return cycles;
                    }
                }
            } else if !visited.contains(&neighbor_id) {
                visited.insert(neighbor_id.clone());
                on_path.insert(neighbor_id.clone());
                path.push(neighbor_id.clone());
                stack.push(DfsFrame {
                    id: neighbor_id.clone(),
                    neighbors: adjacency.get(&neighbor_id).cloned().unwrap_or_default(),
                    index: 0,
                });
            }
        }
    }

    cycles
}

fn compute_ranks_values(input: RanksInput) -> HashMap<String, u32> {
    let RanksInput {
        node_ids,
        adjacency,
        in_degrees,
    } = input;

    let mut ranks: HashMap<String, u32> = HashMap::new();
    let mut current_in_degrees: HashMap<String, i64> = HashMap::new();
    let mut queue: VecDeque<String> = VecDeque::new();

    for node_id in &node_ids {
        ranks.insert(node_id.clone(), 0);
        let normalized_in_degree = in_degrees.get(node_id).copied().unwrap_or(0);
        current_in_degrees.insert(node_id.clone(), normalized_in_degree);
        if normalized_in_degree == 0 {
            queue.push_back(node_id.clone());
        }
    }

    while let Some(u_id) = queue.pop_front() {
        let u_rank = ranks.get(&u_id).copied().unwrap_or(0);
        if let Some(neighbors) = adjacency.get(&u_id) {
            for v_id in neighbors {
                let Some(current_in_degree) = current_in_degrees.get(v_id).copied() else {
                    continue;
                };

                let current_v_rank = ranks.get(v_id).copied().unwrap_or(0);
                let candidate_rank = u_rank.saturating_add(1);
                if candidate_rank > current_v_rank {
                    ranks.insert(v_id.clone(), candidate_rank);
                }

                let next_in_degree = current_in_degree - 1;
                current_in_degrees.insert(v_id.clone(), next_in_degree);
                if next_in_degree == 0 {
                    queue.push_back(v_id.clone());
                }
            }
        }
    }

    ranks
}

#[no_mangle]
pub extern "C" fn wasm_parity_version() -> u32 {
    1
}

#[no_mangle]
pub extern "C" fn alloc(size: usize) -> *mut u8 {
    if size == 0 {
        return std::ptr::null_mut();
    }
    let mut buffer = Vec::<u8>::with_capacity(size);
    let ptr = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    ptr
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, size: usize) {
    if ptr.is_null() || size == 0 {
        return;
    }
    unsafe {
        drop(Vec::from_raw_parts(ptr, 0, size));
    }
}

#[no_mangle]
pub extern "C" fn get_last_result_len() -> usize {
    LAST_RESULT.with(|buffer| buffer.borrow().len())
}

#[no_mangle]
pub extern "C" fn compute_layout_json(input_ptr: *const u8, input_len: usize) -> usize {
    let Some(bytes) = with_input_bytes(input_ptr, input_len) else {
        return set_empty_result();
    };
    let Ok(raw) = String::from_utf8(bytes) else {
        return set_empty_result();
    };
    let Ok(input) = serde_json::from_str::<LayoutInput>(&raw) else {
        return set_empty_result();
    };

    let output = compute_layout_payload(input);
    set_last_result_json(&output)
}

#[no_mangle]
pub extern "C" fn compute_betweenness_json(input_ptr: *const u8, input_len: usize) -> usize {
    let Some(bytes) = with_input_bytes(input_ptr, input_len) else {
        return set_empty_result();
    };
    let Ok(raw) = String::from_utf8(bytes) else {
        return set_empty_result();
    };
    let Ok(input) = serde_json::from_str::<BetweennessInput>(&raw) else {
        return set_empty_result();
    };

    let values = compute_betweenness_values(input);
    let output = BetweennessOutput { values };
    set_last_result_json(&output)
}

#[no_mangle]
pub extern "C" fn compute_cycles_json(input_ptr: *const u8, input_len: usize) -> usize {
    let Some(bytes) = with_input_bytes(input_ptr, input_len) else {
        return set_empty_result();
    };
    let Ok(raw) = String::from_utf8(bytes) else {
        return set_empty_result();
    };
    let Ok(input) = serde_json::from_str::<CyclesInput>(&raw) else {
        return set_empty_result();
    };

    let cycles = compute_cycles_values(input);
    let output = CyclesOutput { cycles };
    set_last_result_json(&output)
}

#[no_mangle]
pub extern "C" fn compute_ranks_json(input_ptr: *const u8, input_len: usize) -> usize {
    let Some(bytes) = with_input_bytes(input_ptr, input_len) else {
        return set_empty_result();
    };
    let Ok(raw) = String::from_utf8(bytes) else {
        return set_empty_result();
    };
    let Ok(input) = serde_json::from_str::<RanksInput>(&raw) else {
        return set_empty_result();
    };

    let ranks = compute_ranks_values(input);
    let output = RanksOutput { ranks };
    set_last_result_json(&output)
}

#[no_mangle]
pub extern "C" fn compute_layout(_nodes: i32, _edges: i32, _repulsion: f64, _distance: f64) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn compute_betweenness(_node_count: i32, _edge_count: i32) -> i32 {
    0
}
